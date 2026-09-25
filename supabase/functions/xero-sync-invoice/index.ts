// Posts a sale to Xero: ACCREC invoice at full sale value (VAT inclusive) and a stock-out
// manual journal (Dr COGS / Cr stock at purchase price, plus margin VAT Dr sales / Cr VAT).
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import {
  serviceClient, requireUser, profileFor, getXeroAuth, xeroFetch, findOrCreateContact, isVatRegistered,
  logXeroError, round2, stockInRef, stockOutRef,
} from '../_shared/xero.ts';
import { marginVat, taxTypeFor, saleInvoiceLines, saleJournalLines } from '../_shared/xero-postings.ts';

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
      .select('*, bikes:bike_id(*), external_owners:external_customer_id(*)').eq('id', invoiceId).maybeSingle();
    if (error) throw new Error(error.message);
    const inv = invoice as any;
    if (!inv || inv.business_id !== businessId) return json({ error: 'Invoice not found' }, 404);

    const { data: integ, error: iErr } = await supabase.from('integrations').select('is_active')
      .eq('name', 'xero').eq('business_id', businessId).maybeSingle();
    if (iErr) throw new Error(iErr.message);
    if (!integ?.is_active) return json({ ok: true, skipped: 'Xero is not connected' });

    const bike = inv.bikes;
    const customer = inv.external_owners;
    if (!customer?.name) throw new Error('Invoice has no customer to send to Xero');

    const auth = await getXeroAuth(supabase, businessId);
    const call = (p: string, init?: RequestInit) => xeroFetch(auth, p, init);
    const accounts = auth.settings.accounts ?? {};
    if (!accounts.sales) throw new Error('Xero account mapping is incomplete (Sales account is required)');

    const vatRegistered = await isVatRegistered(supabase, businessId);
    const isMargin = vatRegistered && bike?.finance_scheme === 'margin_scheme';
    const balanceDue = Number(inv.gross || inv.total || 0);
    const partEx = Number(inv.part_exchange_value || 0);
    const delivery = inv.delivery_charged_to_customer ? Number(inv.delivery_charge || 0) : 0;
    // VAT always follows the FULL sale value, part exchange included.
    const gross = Number(inv.sale_gross || 0) || Math.max(0, balanceDue + partEx - delivery);
    const purchase = round2(Number(bike?.purchase_price || 0));
    const mVat = isMargin ? marginVat(gross, purchase) : 0;
    const description = `${[bike?.make, bike?.model].filter(Boolean).join(' ')} (${bike?.reference || ''})`.trim();
    const ref = bike?.reference || bike?.id || '';
    const date = (inv.issued_at || new Date().toISOString()).slice(0, 10);

    const contactId = await findOrCreateContact(call, customer);
    const xInvoice: Record<string, unknown> = {
      Type: 'ACCREC',
      Contact: { ContactID: contactId },
      InvoiceNumber: inv.invoice_number,
      Reference: `${ref} · ${stockOutRef(ref) ?? ''}`.slice(0, 255),
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
    const lines = saleJournalLines(purchase, mVat, accounts, description || 'bike');
    if (lines.length) {
      const mj: Record<string, unknown> = {
        Narration: `Stock out / sale of ${description || 'bike'} | Invoice ${inv.invoice_number} | ${stockInRef(ref) ?? ''} | ${stockOutRef(ref) ?? ''}`.slice(0, 4000),
        Date: date,
        Status: 'POSTED',
        JournalLines: lines,
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
