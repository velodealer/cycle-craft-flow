// Mirrors a QuickBooks invoice (lines, totals, paid status) for VeloDealer.
// Public mode: { token } — 64-hex secret link, no account needed, returns only
// what is printed on the customer's invoice. Staff mode: { invoice_id } + JWT.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';
import { serviceClient, requireUser, getQboAuth, qboFetch } from '../_shared/quickbooks.ts';
import { fetchQboInvoicePdf, qboInvoiceAppUrl } from '../_shared/quickbooks-invoice-doc.ts';

const headers = { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
const NOT_FOUND = () => json({ error: 'Invoice not found' }, 404);

const Body = z.union([
  z.object({ token: z.string().regex(/^[a-f0-9]{64}$/), pdf: z.boolean().optional() }),
  z.object({ invoice_id: z.string().uuid(), pdf: z.boolean().optional() }),
]);

const addr = (a: any) => a ? [a.Line1, a.Line2, a.Line3, a.City, a.CountrySubDivisionCode, a.PostalCode, a.Country].filter(Boolean) : [];
const num = (v: unknown) => Math.round(Number(v || 0) * 100) / 100;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const supabase = serviceClient();
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NOT_FOUND();
  const input = parsed.data as { token?: string; invoice_id?: string; pdf?: boolean };
  const staff = !!input.invoice_id;

  let inv: any;
  if (staff) {
    let user;
    try { user = await requireUser(req, supabase); } catch { return json({ error: 'Unauthorized' }, 401); }
    const { data: profile } = await supabase.from('profiles').select('business_id').eq('user_id', user.id).maybeSingle();
    const { data } = await supabase.from('invoices').select('business_id, quickbooks_invoice_id, public_token, sync_error, invoice_number').eq('id', input.invoice_id!).maybeSingle();
    if (!data || !profile || data.business_id !== profile.business_id) return NOT_FOUND();
    inv = data;
  } else {
    const { data } = await supabase.from('invoices').select('business_id, quickbooks_invoice_id, status').eq('public_token', input.token!).maybeSingle();
    if (!data || data.status === 'cancelled') return NOT_FOUND();
    inv = data;
  }

  if (!inv.quickbooks_invoice_id) {
    return staff
      ? json({ error: inv.sync_error ? `Not in QuickBooks yet: ${inv.sync_error}` : 'This invoice has not been sent to QuickBooks yet', not_synced: true }, 409)
      : json({ error: 'This invoice is not ready yet' }, 404);
  }

  try {
    const qid = inv.quickbooks_invoice_id as string;
    if (input.pdf) {
      return json({ pdf_base64: await fetchQboInvoicePdf(supabase, qid) });
    }
    const { accessToken, realmId } = await getQboAuth(supabase);
    const [r, company] = await Promise.all([
      qboFetch(accessToken, realmId, `/invoice/${encodeURIComponent(qid)}?minorversion=70`),
      qboFetch(accessToken, realmId, `/companyinfo/${encodeURIComponent(realmId)}?minorversion=70`).catch(() => null),
    ]);
    const q = r?.Invoice;
    if (!q) return NOT_FOUND();

    // Payment dates come from the linked QuickBooks payments.
    const paymentIds: string[] = (q.LinkedTxn ?? []).filter((t: any) => t.TxnType === 'Payment').map((t: any) => t.TxnId);
    const payments = (await Promise.all(paymentIds.slice(0, 10).map(async (id) => {
      const p = await qboFetch(accessToken, realmId, `/payment/${encodeURIComponent(id)}?minorversion=70`).catch(() => null);
      const pay = p?.Payment;
      if (!pay) return null;
      const applied = (pay.Line ?? []).filter((l: any) => (l.LinkedTxn ?? []).some((t: any) => t.TxnType === 'Invoice' && t.TxnId === qid))
        .reduce((s: number, l: any) => s + Number(l.Amount || 0), 0);
      return { date: pay.TxnDate, amount: num(applied || pay.TotalAmt) };
    }))).filter(Boolean) as { date: string; amount: number }[];
    payments.sort((a, b) => a.date.localeCompare(b.date));

    const total = num(q.TotalAmt);
    const balance = num(q.Balance);
    const today = new Date().toISOString().slice(0, 10);
    const status = balance <= 0 ? 'paid' : balance < total ? (q.DueDate && q.DueDate < today ? 'overdue' : 'partial') : (q.DueDate && q.DueDate < today ? 'overdue' : 'unpaid');

    const lines = (q.Line ?? [])
      .filter((l: any) => l.DetailType === 'SalesItemLineDetail' || l.DetailType === 'DescriptionOnly')
      .map((l: any) => ({
        description: l.Description || l.SalesItemLineDetail?.ItemRef?.name || '',
        qty: l.SalesItemLineDetail?.Qty ?? null,
        unit_price: l.SalesItemLineDetail?.UnitPrice != null ? num(l.SalesItemLineDetail.UnitPrice) : null,
        amount: num(l.Amount),
      }));
    const subtotal = num((q.Line ?? []).find((l: any) => l.DetailType === 'SubTotalLineDetail')?.Amount ?? lines.reduce((s: number, l: any) => s + l.amount, 0));
    const ci = company?.CompanyInfo;

    const body: Record<string, unknown> = {
      doc_number: q.DocNumber ?? null,
      txn_date: q.TxnDate ?? null,
      due_date: q.DueDate ?? null,
      currency: q.CurrencyRef?.value || 'GBP',
      customer_name: q.CustomerRef?.name ?? null,
      bill_address: addr(q.BillAddr),
      customer_memo: q.CustomerMemo?.value ?? null,
      lines,
      subtotal,
      tax: num(q.TxnTaxDetail?.TotalTax),
      total,
      balance,
      amount_paid: num(total - balance),
      status,
      payments,
      paid_at: status === 'paid' ? (payments.at(-1)?.date ?? null) : null,
      seller: ci ? {
        name: ci.CompanyName || ci.LegalName || null,
        address: addr(ci.CompanyAddr),
        email: ci.Email?.Address ?? null,
        phone: ci.PrimaryPhone?.FreeFormNumber ?? null,
      } : null,
      pay_link: null as string | null,
    };
    const link = await qboFetch(accessToken, realmId, `/invoice/${encodeURIComponent(qid)}?include=invoiceLink&minorversion=70`).catch(() => null);
    if (status !== 'paid') body.pay_link = link?.Invoice?.InvoiceLink || null;
    // Dealer branding: logo, trading name and bank (BACS) details for payment.
    const [{ data: biz }, { data: brand }] = await Promise.all([
      supabase.from('businesses').select('name').eq('id', inv.business_id).maybeSingle(),
      supabase.from('app_settings').select('value').eq('key', `invoice_branding:${inv.business_id}`).maybeSingle(),
    ]);
    const bv = (brand?.value ?? {}) as Record<string, string | undefined>;
    body.branding = {
      business_name: biz?.name ?? null,
      logo_url: bv.logo_url || null,
      footer_note: bv.footer_note || null,
      bank: bv.account_number ? { account_name: bv.account_name || null, account_number: bv.account_number, sort_code: bv.sort_code || null } : null,
    };
    if (staff) {
      body.public_token = inv.public_token;
      body.app_url = qboInvoiceAppUrl(qid);
    }
    return json(body);
  } catch (e) {
    const msg = (e as Error).message;
    console.error('invoice-view error', msg);
    if (staff && (/Object Not Found/i.test(msg) || /"code"\s*:\s*"?610"?/.test(msg))) {
      return json({ error: 'QuickBooks no longer has this invoice (it was deleted or made inactive there). Re-send it to QuickBooks to create a fresh copy.', qbo_missing: true }, 409);
    }
    return json({ error: staff ? msg : 'Invoice is temporarily unavailable' }, 502);
  }
});
