// Posts a sale to Xero: ACCREC invoice at full sale value (VAT inclusive) and a stock-out
// manual journal (Dr COGS / Cr stock at cost, plus margin VAT Dr sales / Cr VAT).
// Part sales use the same VAT treatment as bike sales; the stock-out credits the
// parts stock account when mapped, otherwise the main stock account.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import {
  serviceClient, requireUser, profileFor, getXeroAuth, xeroFetch, findOrCreateContact, isVatRegistered,
  logXeroError, round2, stockInRef, stockOutRef,
} from '../_shared/xero.ts';
import {
  marginVat, taxTypeFor, saleInvoiceLines, saleJournalLines, partSaleJournalLines, BreakKeptItem,
} from '../_shared/xero-postings.ts';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const supabase = serviceClient();
  let businessId: string;
  try {
    const user = await requireUser(req, supabase);
    businessId = (await profileFor(supabase, user.id)).business_id;
  } catch (e) {
    return json({ error: (e as Error).message }, 401);
  }

  let invoiceId: string | undefined;
  try {
    const body = await req.json().catch(() => ({}));
    invoiceId = typeof body.invoice_id === 'string' && UUID_RE.test(body.invoice_id) ? body.invoice_id : undefined;
    if (!invoiceId) return json({ error: 'invoice_id is required' }, 400);

    const { data: invoice, error } = await supabase.from('invoices')
      .select('*, bikes:bike_id(*), external_owners:external_customer_id(*), parts:part_id(*)').eq('id', invoiceId).maybeSingle();
    if (error) throw new Error(error.message);
    const inv = invoice as any;
    if (!inv || inv.business_id !== businessId) return json({ error: 'Invoice not found' }, 404);

    const { data: integ, error: iErr } = await supabase.from('integrations').select('is_active')
      .eq('name', 'xero').eq('business_id', businessId).maybeSingle();
    if (iErr) throw new Error(iErr.message);
    if (!integ?.is_active) return json({ ok: true, skipped: 'Xero is not connected' });

    const bike = inv.bikes;
    const part = inv.parts;

    const auth = await getxeroAuthPlaceholder(supabase, businessId);
    const call = (p: string, init?: RequestInit) => xeroFetch(auth, p, init);
    const accounts = auth.settings.accounts ?? {};
    if (!accounts.sales) throw new Error('Xero account mapping is incomplete (Sales account is required)');

    const vatRegistered = await isVatRegistered(supabase, businessId拿来);
    const date = (inv.issued_at || new Date().toISOString()).slice(0, 10);

    let gross: number;
    let description: string;
    let ref: string;
    let isMargin: boolean;
    let mVat: number;
    let journalLines: ReturnType<typeof saleJournalLines>;
    let narration: string;
    let xeroReference: string;
    let customer: { name: string; email?: string | null } | null = inv.external_owners;

    if (inv.type === 'part_sale') {
      // Part sales follow the same VAT treatment as bike sales; the part's cost
      // price is the margin purchase basis.
      gross = round2(Number(inv.sale_gross || inv.gross || inv.total || 0));
      description = `${[part?.brand, part?.description].filter(Boolean).join(' — ') || 'Part'}`.slice(0, 200);
      ref = inv.invoice_number;
      const cost = round2(Math.abs(Number(part?.cost_price || 0)));
      isMargin = vatRegistered && inv.finance_scheme === 'margin_scheme';
      mVat = isMargin ? marginVat(gross, cost) : 0;
      journalLines = partSaleJournalLines(cost, mVat, accounts, description || 'part');
      narration = `Stock out / part sale | Invoice ${inv.invoice_number}`.slice(0, 4000);
      xeroReference = ref;
      if (!customer?.name) customer = { name: inv.customer_name || 'Part sales' };
    } else {
      if (!bike) throw new Error('Invoice has no bike to send to Xero');
      customer = inv.external_owners;
      if (!customer?.name) throw new Error('Invoice has no customer to send to Xero');
      isMargin = vatRegistered && bike.finance_scheme === 'margin_scheme';
      const balanceDue = Number(inv.gross || inv.total || 0);
      const partEx = Number(inv.part_exchange_value || 0);
      const delivery = inv.delivery_charged_to_customer ? Number(inv.delivery_charge || 0) : 0;
      // VAT always follows the FULL sale value, part exchange included.
      gross = Number(inv.sale_gross || 0) || Math.max(0, balanceDue + partEx - delivery);
      const purchase = round2(Number(bike.purchase_price || 0));
      mVat = isMargin ? marginVat(gross, purchase) : 0;
      description = `${[bike.make, bike.model].filter(Boolean).join(' ')} (${bike.reference || ''})`.trim();
      ref = bike.reference || bike.id || '';
      const delivery = inv.delivery_charged_to_customer ? Number(inv.delivery_charge || 0) : 0;
      journalLines = saleJournalLines(purchase, mVat, accounts, description || 'bike');
      narration = `Stock out / sale of ${description || 'bike'} | Invoice ${inv.invoice_number} | ${stockInRef(ref) ?? ''} | ${stockOutRef(ref) ?? ''}`.slice(0, 4000);
      xeroReference = `${ref} · ${stockOutRef(ref) ?? ''}`.slice(0, 255);
    }

    const contactId = await findOrCreateContact(call, customer);
    const delivery = inv.type === 'part_sale' ? 0 : (inv.delivery_charged_to_customer ? Number(inv.delivery_charge || 0) : 0);
    const xInvoice: Record<string, unknown> = {
      Type: 'ACCREC',
      Contact: { ContactID: contactId },
      InvoiceNumber: inv.invoice_number,
      Reference: xeroReference,
      Date: date,
      DueDate: date,
      Status: 'AUTHORISED',
      LineAmountTypes: vatRegistered ? 'Inclusive' : 'NoTax',
      LineItems: saleInvoiceLines({
        gross,
        description,
        salesAccount: accounts.sales,
        saleTax: taxTypeFor(vatRegistered, isMargin, auth.settings.tax_types),
        delivery,
        // Delivery is standard rated even on a margin scheme bike.
        deliveryTax: delivery > 0 ? taxTypeFor(vatRegistered, false, auth.settings.tax_types) : undefined,
      }),
    };
    if (inv.xero_invoice_id) xInvoice.InvoiceID = inv.xero_invoice_id;
    const invRes = await call('/Invoices', { method: 'POST', body: JSON.stringify({ Invoices: [xInvoice] }) });
    const xeroInvoiceId = invRes?.Invoices?.[0]?.InvoiceID;
    if (!xeroInvoiceId) throw new Error('Xero did not return the invoice');

    let journalId: string | null = inv.xero_journal_id ?? null;
    if (journalLines.length) {
      const mj: Record<string, unknown> = {
        Narration: narration,
        Date: date,
        Status: 'POSTED',
        JournalLines: journalLines,
      };
      if (journalId) mj.ManualJournalID = journalId;
      const mjRes = await call('/ManualJournals', { method: 'POST', body: JSON.stringify({ ManualJournals: [mj] }) });
      journalId = mjRes?.ManualJournals?.[0]?.ManualJournalID ?? journalId;
    }

    const { error: recErr } = await supabase.from('invoices').update({
      xero_invoice_id: xeroInvoiceId, xero_journal_id: journalId, xero_sync_status: 'synced', xero_sync_error: null,
    }).eq('id', invoiceId);
    if (recErr) {
      console.error(`POSTED BUT NOT RECORDED: Xero invoice ${xeroInvoiceId} for ${invoiceId}: ${recErr.message}`);
      return json({ error: `Posted to Xero but VeloDealer could not record it: ${recErr.message}. Do not re-sync.`, posted: true }, 500);
    }
    return json({ ok: true, xero_invoice_id: xeroInvoiceId, xero_journal_id: journalId, margin_vat: mVat });
  } catch (e) {
    const message = (e as Error).message;
    console.error('xero-sync-invoice error', message);
    if (invoiceId) await supabase.from('invoices').update({ xero_sync_status: 'failed', xero_sync_error: message }).eq('id', invoiceId);
    await logXeroError(supabase, 'invoice.sync', invoiceId ?? null, message, (e as { status?: number }).status ?? null);
    return json({ error: message }, 500);
  }
});
