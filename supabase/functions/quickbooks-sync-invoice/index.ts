import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { serviceClient, getQboAuth, qboFetch, requireUser, type QboSettings } from '../_shared/quickbooks.ts';
import { taxCodeForScheme } from '../_shared/quickbooks-tax.ts';
import { findOrCreateCustomer, findOrCreateItem } from '../_shared/quickbooks-names.ts';
import { buildSaleInvoiceLines } from '../_shared/quickbooks-lines.ts';


const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });


Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = serviceClient();
  try {
    await requireUser(req, supabase);
  } catch (e) {
    return json({ error: (e as Error).message }, 401);
  }

  let invoiceId: string | undefined;
  try {
    const body = await req.json().catch(() => ({}));
    invoiceId = typeof body.invoice_id === 'string' ? body.invoice_id : undefined;
    if (!invoiceId) return json({ error: 'invoice_id is required' }, 400);

    const { data: invoice, error: invError } = await supabase
      .from('invoices')
      .select('*, bikes:bike_id(*), external_owners:external_customer_id(*)')
      .eq('id', invoiceId)
      .maybeSingle();
    if (invError) throw new Error(invError.message);
    if (!invoice) return json({ error: 'Invoice not found' }, 404);

    const bike: any = invoice.bikes;
    const customer: any = invoice.external_owners;
    if (!customer?.name) throw new Error('Invoice has no customer to send to QuickBooks');

    const { accessToken, realmId, settings } = await getQboAuth(supabase);
    const accounts = ((settings as QboSettings).accounts ?? {});
    if (!accounts.sales || !accounts.stock || !accounts.cogs) {
      throw new Error('QuickBooks account mapping is incomplete (Sales, Stock and COGS accounts are required)');
    }

    const isMargin = bike?.finance_scheme === 'margin_scheme';
    const salesTaxCode = taxCodeForScheme(isMargin, (settings as QboSettings).tax_codes);
    const noVatTaxCode = taxCodeForScheme(true, (settings as QboSettings).tax_codes);
    const balanceDue = Number(invoice.gross || invoice.total || 0);
    const partExValue = Number(invoice.part_exchange_value || 0);
    // VAT always follows the FULL sale value, part exchange included.
    const gross = Number(invoice.sale_gross || 0) || balanceDue + partExValue;
    const purchasePrice = Number(bike?.purchase_price || 0);
    const marginVat = isMargin ? Math.max(0, gross - purchasePrice) * 20 / 120 : 0;

    const description = `${[bike?.make, bike?.model].filter(Boolean).join(' ')} (${bike?.reference || ''})`.trim();
    const bikeReference = bike?.reference || bike?.id || '';
    const stockInDoc = bikeReference ? `STK-IN-${bikeReference}`.slice(0, 21) : null;
    const stockOutDoc = bikeReference ? `STK-OUT-${bikeReference}`.slice(0, 21) : null;
    const fetcher = (path: string, init?: RequestInit) => qboFetch(accessToken, realmId, path, init);
    const customerRef = await findOrCreateCustomer(fetcher, customer);
    const itemRef = await findOrCreateItem(fetcher, accounts.sales);

    let partExItemRef: string | undefined;
    if (partExValue > 0) {
      if (!accounts.part_exchange) {
        throw new Error('Map a QuickBooks "Part exchange clearing" account in Settings, then retry this invoice.');
      }
      partExItemRef = await findOrCreateItem(fetcher, accounts.part_exchange, 'Part exchange allowance');
    }

    // 1. Customer invoice. Margin scheme lines carry no VAT; the part exchange
    // allowance is a negative, VAT-free line so only the cash balance is due.
    const invoicePayload: Record<string, unknown> = {
      CustomerRef: { value: customerRef },
      DocNumber: invoice.invoice_number,
      TxnDate: (invoice.issued_at || new Date().toISOString()).slice(0, 10),
      GlobalTaxCalculation: isMargin ? 'NotApplicable' : 'TaxInclusive',
      Line: buildSaleInvoiceLines({
        saleGross: gross,
        partExchangeValue: partExValue,
        description,
        saleItemRef: itemRef,
        saleTaxCode: salesTaxCode,
        partExchangeItemRef: partExItemRef,
        noVatTaxCode,
      }),
      PrivateNote: [
        isMargin
          ? `Margin scheme sale. VAT of ${marginVat.toFixed(2)} posted to the VAT control account by journal.`
          : 'Standard VAT sale.',
        ...(partExValue > 0
          ? [`Part exchange allowance of ${partExValue.toFixed(2)} taken; balance due ${balanceDue.toFixed(2)}. VAT is on the full sale value.`]
          : []),
        `Bike reference: ${bikeReference || '—'}`,
        `Stock in journal: ${stockInDoc || '—'}`,
        `Stock out journal: ${stockOutDoc || '—'}`,
      ].join(' | '),
    };



    if (invoice.quickbooks_invoice_id) {
      const existing = await qboFetch(accessToken, realmId, `/invoice/${invoice.quickbooks_invoice_id}?minorversion=70`);
      if (existing?.Invoice) {
        invoicePayload.Id = existing.Invoice.Id;
        invoicePayload.SyncToken = existing.Invoice.SyncToken;
        invoicePayload.sparse = false;
      }
    }

    const invoiceResult = await qboFetch(accessToken, realmId, '/invoice?minorversion=70', {
      method: 'POST',
      body: JSON.stringify(invoicePayload),
    });
    const qbInvoiceId = invoiceResult?.Invoice?.Id;

    // 2. Journal: move stock (purchase price only) to COGS, plus margin VAT to VAT control.
    let journalId = invoice.quickbooks_journal_id as string | null;
    const lines: Record<string, unknown>[] = [];
    const note = [
      `Stock out / sale of ${description || 'bike'}`,
      `Invoice: ${invoice.invoice_number}`,
      `Bike reference: ${bikeReference || '—'}`,
      `Stock in journal: ${stockInDoc || '—'}`,
      `Doc number: ${stockOutDoc || '—'}`,
    ].join(' | ');


    if (purchasePrice > 0) {
      lines.push({
        Description: `Cost of goods sold — ${description}`,
        Amount: purchasePrice,
        DetailType: 'JournalEntryLineDetail',
        JournalEntryLineDetail: { PostingType: 'Debit', AccountRef: { value: accounts.cogs } },
      });
      lines.push({
        Description: `Stock released — ${description}`,
        Amount: purchasePrice,
        DetailType: 'JournalEntryLineDetail',
        JournalEntryLineDetail: { PostingType: 'Credit', AccountRef: { value: accounts.stock } },
      });
    }

    if (marginVat > 0) {
      if (!accounts.vat) throw new Error('A VAT control account must be mapped for margin scheme sales');
      lines.push({
        Description: `Margin scheme VAT — ${description}`,
        Amount: Number(marginVat.toFixed(2)),
        DetailType: 'JournalEntryLineDetail',
        JournalEntryLineDetail: { PostingType: 'Credit', AccountRef: { value: accounts.vat } },
      });
      lines.push({
        Description: `Margin scheme VAT (sales adjustment) — ${description}`,
        Amount: Number(marginVat.toFixed(2)),
        DetailType: 'JournalEntryLineDetail',
        JournalEntryLineDetail: { PostingType: 'Debit', AccountRef: { value: accounts.sales } },
      });
    }

    if (lines.length > 0) {
      const journalPayload: Record<string, unknown> = {
        ...(stockOutDoc ? { DocNumber: stockOutDoc } : {}),
        TxnDate: (invoice.issued_at || new Date().toISOString()).slice(0, 10),
        PrivateNote: note,
        Line: lines,
      };

      if (journalId) {
        const existing = await qboFetch(accessToken, realmId, `/journalentry/${journalId}?minorversion=70`);
        if (existing?.JournalEntry) {
          journalPayload.Id = existing.JournalEntry.Id;
          journalPayload.SyncToken = existing.JournalEntry.SyncToken;
          journalPayload.sparse = false;
        }
      }
      const journalResult = await qboFetch(accessToken, realmId, '/journalentry?minorversion=70', {
        method: 'POST',
        body: JSON.stringify(journalPayload),
      });
      journalId = journalResult?.JournalEntry?.Id ?? journalId;
    }

    await supabase.from('invoices').update({
      quickbooks_invoice_id: qbInvoiceId,
      quickbooks_journal_id: journalId,
      sync_status: 'synced',
      sync_error: null,
    }).eq('id', invoiceId);

    return json({ ok: true, quickbooks_invoice_id: qbInvoiceId, quickbooks_journal_id: journalId, margin_vat: marginVat });
  } catch (e) {
    const message = (e as Error).message;
    console.error('quickbooks-sync-invoice error', message);
    if (invoiceId) {
      await supabase.from('invoices')
        .update({ sync_status: 'failed', sync_error: message })
        .eq('id', invoiceId);
    }
    return json({ error: message }, 500);
  }
});
