import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { serviceClient, getQboAuth, qboFetch, requireUser, type QboSettings } from '../_shared/quickbooks.ts';
import { purchaseFundingAccount } from '../_shared/quickbooks-lines.ts';
import { findAccountsReceivableAccount, findOrCreateCustomer } from '../_shared/quickbooks-names.ts';

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

  let bikeId: string | undefined;
  try {
    const body = await req.json().catch(() => ({}));
    bikeId = typeof body.bike_id === 'string' ? body.bike_id : undefined;
    if (!bikeId) return json({ error: 'bike_id is required' }, 400);

    const { data: bike, error: bikeError } = await supabase
      .from('bikes')
      .select('id, reference, make, model, frame_number, intake_date, purchase_price, purchase_date, acquired_via, part_exchange_invoice_id, quickbooks_purchase_journal_id')
      .eq('id', bikeId)
      .maybeSingle();
    if (bikeError) throw new Error(bikeError.message);
    if (!bike) return json({ error: 'Bike not found' }, 404);

    const amount = Number(bike.purchase_price || 0);
    if (!(amount > 0)) {
      await supabase.from('bikes')
        .update({ purchase_sync_status: 'skipped', purchase_sync_error: null })
        .eq('id', bikeId);
      return json({ ok: true, skipped: 'No purchase price to post' });
    }

    const { accessToken, realmId, settings } = await getQboAuth(supabase);
    const accounts = ((settings as QboSettings).accounts ?? {});
    if (!accounts.stock) {
      throw new Error('QuickBooks account mapping is incomplete (Stock and purchase funding accounts are required)');
    }
    const isPartExchange = (bike as any).acquired_via === 'part_exchange';
    const fundingAccount = purchaseFundingAccount((bike as any).acquired_via, accounts);
    const fetcher = (path: string, init?: RequestInit) => qboFetch(accessToken, realmId, path, init);

    const reference = bike.reference || bike.id;
    const docNumber = `STK-IN-${reference}`.slice(0, 21);
    const label = `Bike purchase ${reference} — ${[bike.make, bike.model].filter(Boolean).join(' ')}`;

    // Part exchange: credit Accounts Receivable against the sale customer so the
    // allowance settles part of their (full-value) invoice — no clearing account.
    let creditLineDetail: Record<string, unknown>;
    let partExInvoiceNumber: string | null = null;
    if (isPartExchange) {
      const invoiceId = (bike as any).part_exchange_invoice_id as string | null;
      if (!invoiceId) {
        throw new Error('This part-exchange bike is not linked to a sale invoice, so the AR credit cannot be posted.');
      }
      const { data: pxInvoice, error: pxError } = await supabase
        .from('invoices')
        .select('invoice_number, external_owners:external_customer_id(name, email, phone, address)')
        .eq('id', invoiceId)
        .maybeSingle();
      if (pxError) throw new Error(pxError.message);
      const customer: any = (pxInvoice as any)?.external_owners;
      if (!customer?.name) {
        throw new Error('The linked sale invoice has no customer, so the AR credit cannot be posted.');
      }
      partExInvoiceNumber = (pxInvoice as any)?.invoice_number ?? null;
      const customerRef = await findOrCreateCustomer(fetcher, customer);
      const arAccount = await findAccountsReceivableAccount(fetcher);
      creditLineDetail = {
        PostingType: 'Credit',
        AccountRef: { value: arAccount },
        Entity: { Type: 'Customer', EntityRef: { value: customerRef } },
      };
    } else {
      creditLineDetail = { PostingType: 'Credit', AccountRef: { value: fundingAccount } };
    }

    const note = [
      isPartExchange ? 'Stock in (bike taken in part exchange)' : 'Stock in (bike purchase)',
      `Bike reference: ${reference}`,
      `Bike: ${[bike.make, bike.model].filter(Boolean).join(' ') || '—'}`,
      `Frame number: ${bike.frame_number || '—'}`,
      `Intake date: ${(bike.intake_date || bike.purchase_date || new Date().toISOString()).slice(0, 10)}`,
      ...(partExInvoiceNumber ? [`Settled against sale invoice: ${partExInvoiceNumber}`] : []),
      `Doc number: ${docNumber}`,
    ].join(' | ');

    const payload: Record<string, unknown> = {
      DocNumber: docNumber,
      TxnDate: (bike.purchase_date || new Date().toISOString()).slice(0, 10),
      PrivateNote: note,
      Line: [
        {
          Description: label,
          Amount: amount,
          DetailType: 'JournalEntryLineDetail',
          JournalEntryLineDetail: { PostingType: 'Debit', AccountRef: { value: accounts.stock } },
        },
        {
          Description: isPartExchange
            ? `Part exchange allowance settled against invoice ${partExInvoiceNumber || ''} — ${label}`.trim()
            : label,
          Amount: amount,
          DetailType: 'JournalEntryLineDetail',
          JournalEntryLineDetail: creditLineDetail,
        },
      ],
    };


    // Update in place when we already posted this bike's purchase.
    if (bike.quickbooks_purchase_journal_id) {
      const existing = await qboFetch(
        accessToken,
        realmId,
        `/journalentry/${bike.quickbooks_purchase_journal_id}?minorversion=70`,
      );
      const je = existing?.JournalEntry;
      if (je) {
        payload.Id = je.Id;
        payload.SyncToken = je.SyncToken;
        payload.sparse = false;
      }
    }

    const result = await qboFetch(accessToken, realmId, '/journalentry?minorversion=70', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    const journalId = result?.JournalEntry?.Id;

    await supabase.from('bikes').update({
      quickbooks_purchase_journal_id: journalId,
      purchase_sync_status: 'synced',
      purchase_sync_error: null,
    }).eq('id', bikeId);

    return json({ ok: true, journal_id: journalId, amount });
  } catch (e) {
    const message = (e as Error).message;
    console.error('quickbooks-sync-purchase error', message);
    if (bikeId) {
      await supabase.from('bikes')
        .update({ purchase_sync_status: 'failed', purchase_sync_error: message })
        .eq('id', bikeId);
    }
    return json({ error: message }, 500);
  }
});
