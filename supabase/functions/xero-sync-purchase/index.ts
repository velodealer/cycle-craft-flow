// Posts a bike's stock-in to Xero: manual journal Dr stock / Cr funding (purchase price only).
// Part exchange: a sales credit note to the customer coded to stock (Dr stock / Cr AR),
// allocated to the sale invoice when it is already in Xero. Stored as "CN:<id>".
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import {
  serviceClient, requireUser, profileFor, getXeroAuth, xeroFetch, findOrCreateContact, logXeroError, round2, stockInRef,
} from '../_shared/xero.ts';
import { purchaseJournalLines } from '../_shared/xero-postings.ts';

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

  let bikeId: string | undefined;
  try {
    const body = await req.json().catch(() => ({}));
    bikeId = typeof body.bike_id === 'string' && UUID_RE.test(body.bike_id) ? body.bike_id : undefined;
    if (!bikeId) return json({ error: 'bike_id is required' }, 400);

    const { data: bike, error } = await supabase.from('bikes')
      .select('id, business_id, reference, make, model, frame_number, purchase_price, purchase_date, acquired_via, part_exchange_invoice_id, xero_purchase_journal_id')
      .eq('id', bikeId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!bike || (bike as any).business_id !== businessId) return json({ error: 'Bike not found' }, 404);
    const b = bike as any;

    // Only dealerships that connected Xero post to it.
    const { data: integ, error: iErr } = await supabase.from('integrations').select('is_active')
      .eq('name', 'xero').eq('business_id', businessId).maybeSingle();
    if (iErr) throw new Error(iErr.message);
    if (!integ?.is_active) return json({ ok: true, skipped: 'Xero is not connected' });

    const amount = round2(Number(b.purchase_price || 0));
    if (!(amount > 0)) {
      await supabase.from('bikes').update({ xero_purchase_sync_status: 'skipped', xero_purchase_sync_error: null }).eq('id', bikeId);
      return json({ ok: true, skipped: 'No purchase price to post' });
    }

    const auth = await getXeroAuth(supabase, businessId);
    const call = (p: string, init?: RequestInit) => xeroFetch(auth, p, init);
    const accounts = auth.settings.accounts ?? {};
    const reference = b.reference || b.id;
    const label = `Bike purchase ${reference} — ${[b.make, b.model].filter(Boolean).join(' ')}`;
    const date = (b.purchase_date || new Date().toISOString()).slice(0, 10);
    const existing: string | null = b.xero_purchase_journal_id;
    let recorded: string;

    if (b.acquired_via === 'part_exchange') {
      if (!accounts.stock) throw new Error('Xero account mapping is incomplete (Stock account is required)');
      if (!b.part_exchange_invoice_id) throw new Error('This part-exchange bike is not linked to a sale invoice, so the credit cannot be posted.');
      const { data: inv, error: invErr } = await supabase.from('invoices')
        .select('invoice_number, xero_invoice_id, external_owners:external_customer_id(name, email, phone, address)')
        .eq('id', b.part_exchange_invoice_id).maybeSingle();
      if (invErr) throw new Error(invErr.message);
      const customer = (inv as any)?.external_owners;
      if (!customer?.name) throw new Error('The linked sale invoice has no customer, so the credit cannot be posted.');
      const contactId = await findOrCreateContact(call, customer);
      const cn: Record<string, unknown> = {
        Type: 'ACCRECCREDIT',
        Contact: { ContactID: contactId },
        Date: date,
        Status: 'AUTHORISED',
        LineAmountTypes: 'NoTax',
        Reference: `${stockInRef(reference)} · part exchange on ${(inv as any)?.invoice_number ?? ''}`.slice(0, 255),
        LineItems: [{ Description: `Part exchange allowance — ${label}`, Quantity: 1, UnitAmount: amount, AccountCode: accounts.stock, TaxType: 'NONE' }],
      };
      if (existing?.startsWith('CN:')) cn.CreditNoteID = existing.slice(3);
      const res = await call('/CreditNotes', { method: 'POST', body: JSON.stringify({ CreditNotes: [cn] }) });
      const id = res?.CreditNotes?.[0]?.CreditNoteID;
      if (!id) throw new Error('Xero did not return the credit note');
      recorded = `CN:${id}`;
      const xInv = (inv as any)?.xero_invoice_id;
      if (xInv && !existing) {
        await call(`/CreditNotes/${id}/Allocations`, {
          method: 'PUT',
          body: JSON.stringify({ Allocations: [{ Invoice: { InvoiceID: xInv }, Amount: amount, Date: date }] }),
        }).catch((e) => console.warn('Xero credit allocation failed:', (e as Error).message));
      }
    } else {
      const mj: Record<string, unknown> = {
        Narration: `${label} | ${stockInRef(reference)} | Frame ${b.frame_number || '—'}`.slice(0, 4000),
        Date: date,
        Status: 'POSTED',
        JournalLines: purchaseJournalLines(amount, accounts, label),
      };
      if (existing && !existing.startsWith('CN:')) mj.ManualJournalID = existing;
      const res = await call('/ManualJournals', { method: 'POST', body: JSON.stringify({ ManualJournals: [mj] }) });
      const id = res?.ManualJournals?.[0]?.ManualJournalID;
      if (!id) throw new Error('Xero did not return the journal');
      recorded = id;
    }

    const { error: recErr } = await supabase.from('bikes').update({
      xero_purchase_journal_id: recorded, xero_purchase_sync_status: 'synced', xero_purchase_sync_error: null,
    }).eq('id', bikeId);
    if (recErr) {
      console.error(`POSTED BUT NOT RECORDED: Xero ${recorded} for bike ${bikeId}: ${recErr.message}`);
      return json({ error: `Posted to Xero but VeloDealer could not record it: ${recErr.message}. Do not re-sync.`, posted: true }, 500);
    }
    return json({ ok: true, journal_id: recorded, amount });
  } catch (e) {
    const message = (e as Error).message;
    console.error('xero-sync-purchase error', message);
    if (bikeId) await supabase.from('bikes').update({ xero_purchase_sync_status: 'failed', xero_purchase_sync_error: message }).eq('id', bikeId);
    await logXeroError(supabase, 'purchase.sync', bikeId ?? null, message, (e as { status?: number }).status ?? null);
    return json({ error: message }, 500);
  }
});
