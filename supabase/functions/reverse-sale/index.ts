// Reverses a recorded sale: voids the QuickBooks invoice, deletes the stock-out
// journal and any part-exchange bike (with its stock-in journal), removes the
// invoice and resets the bike off "sold".
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { serviceClient, getQboAuth, qboFetch, requireUser } from '../_shared/quickbooks.ts';
import { logBikeActivity } from '../_shared/activity.ts';
import { getXeroAuth, xeroFetch } from '../_shared/xero.ts';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const BIKE_STATUSES = new Set([
  'pending_intake', 'awaiting_collection', 'collection_in_progress', 'in_transit',
  'intake', 'cleaning', 'inspection', 'pending_approval', 'repair', 'ready',
  'listed', 'in_stock', 'split_for_parts',
]);

type Fetcher = (path: string, init?: RequestInit) => Promise<any>;

async function voidInvoice(fetcher: Fetcher, id: string) {
  const existing = await fetcher(`/invoice/${id}?minorversion=70`);
  const inv = existing?.Invoice;
  if (!inv) return;
  await fetcher('/invoice?operation=void&minorversion=70', {
    method: 'POST',
    body: JSON.stringify({ Id: inv.Id, SyncToken: inv.SyncToken, sparse: true }),
  });
}

async function deleteJournal(fetcher: Fetcher, id: string) {
  const existing = await fetcher(`/journalentry/${id}?minorversion=70`);
  const je = existing?.JournalEntry;
  if (!je) return;
  await fetcher('/journalentry?operation=delete&minorversion=70', {
    method: 'POST',
    body: JSON.stringify({ Id: je.Id, SyncToken: je.SyncToken }),
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = serviceClient();
  let user;
  try {
    user = await requireUser(req, supabase);
  } catch (e) {
    return json({ error: (e as Error).message }, 401);
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!profile || profile.role !== 'admin') return json({ error: 'Forbidden: admin only' }, 403);

  try {
    const body = await req.json().catch(() => ({}));
    const invoiceId: string | undefined = typeof body.invoice_id === 'string' ? body.invoice_id : undefined;
    const bikeIdInput: string | undefined = typeof body.bike_id === 'string' ? body.bike_id : undefined;
    const newStatus: string = typeof body.new_status === 'string' && BIKE_STATUSES.has(body.new_status)
      ? body.new_status
      : 'ready';

    if (invoiceId && !UUID_RE.test(invoiceId)) return json({ error: 'Invalid invoice_id' }, 400);
    if (bikeIdInput && !UUID_RE.test(bikeIdInput)) return json({ error: 'Invalid bike_id' }, 400);
    if (!invoiceId && !bikeIdInput) return json({ error: 'invoice_id or bike_id is required' }, 400);

    // Resolve the invoice(s) to reverse.
    let invoices: any[] = [];
    if (invoiceId) {
      const { data, error } = await supabase.from('invoices').select('*').eq('id', invoiceId).maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return json({ error: 'Invoice not found' }, 404);
      invoices = [data];
    } else {
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('bike_id', bikeIdInput!)
        .eq('type', 'sale');
      if (error) throw new Error(error.message);
      invoices = data ?? [];
    }

    const bikeId = bikeIdInput ?? invoices[0]?.bike_id;

    // Part-exchange bikes taken in on these invoices.
    const pxBikeIds = invoices.map((i) => i.part_exchange_bike_id).filter(Boolean) as string[];
    let pxBikes: any[] = [];
    if (pxBikeIds.length) {
      const { data, error: pxErr } = await supabase
        .from('bikes')
        .select('id, make, model, reference, quickbooks_purchase_journal_id, xero_purchase_journal_id')
        .in('id', pxBikeIds);
      // Without these rows their QuickBooks journals would be skipped — stop before touching the ledger.
      if (pxErr) throw new Error(`Could not load part-exchange bikes: ${pxErr.message}`);
      pxBikes = data ?? [];
    }

    // ---- QuickBooks first: if the ledger cannot be reversed, nothing is deleted.
    const needsQbo =
      invoices.some((i) => i.quickbooks_invoice_id || i.quickbooks_journal_id) ||
      pxBikes.some((b) => b.quickbooks_purchase_journal_id);

    if (needsQbo) {
      const { accessToken, realmId } = await getQboAuth(supabase);
      const fetcher: Fetcher = (path, init) => qboFetch(accessToken, realmId, path, init);
      for (const inv of invoices) {
        if (inv.quickbooks_journal_id) await deleteJournal(fetcher, inv.quickbooks_journal_id);
        if (inv.quickbooks_invoice_id) await voidInvoice(fetcher, inv.quickbooks_invoice_id);
      }
      for (const px of pxBikes) {
        if (px.quickbooks_purchase_journal_id) await deleteJournal(fetcher, px.quickbooks_purchase_journal_id);
      }
    }

    // ---- Xero next: void the invoice, journals and part-exchange credit notes.
    const needsXero =
      invoices.some((i) => i.xero_invoice_id || i.xero_journal_id) ||
      pxBikes.some((b) => b.xero_purchase_journal_id);
    if (needsXero) {
      const businessId = invoices[0]?.business_id;
      if (!businessId) throw new Error('Could not work out which dealership this sale belongs to');
      const auth = await getXeroAuth(supabase, businessId);
      const voidDoc = async (kind: 'Invoices' | 'ManualJournals' | 'CreditNotes', idField: string, id: string) => {
        try {
          await xeroFetch(auth, `/${kind}`, { method: 'POST', body: JSON.stringify({ [kind]: [{ [idField]: id, Status: 'VOIDED' }] }) });
        } catch (e) {
          if ((e as { status?: number }).status === 404 || /already.*void/i.test((e as Error).message)) return;
          throw new Error(`Xero could not void ${kind.replace(/s$/, '').toLowerCase()} ${id}: ${(e as Error).message}`);
        }
      };
      for (const px of pxBikes) {
        const j = px.xero_purchase_journal_id as string | null;
        if (j?.startsWith('CN:')) await voidDoc('CreditNotes', 'CreditNoteID', j.slice(3));
        else if (j) await voidDoc('ManualJournals', 'ManualJournalID', j);
      }
      for (const inv of invoices) {
        if (inv.xero_journal_id) await voidDoc('ManualJournals', 'ManualJournalID', inv.xero_journal_id);
        if (inv.xero_invoice_id) await voidDoc('Invoices', 'InvoiceID', inv.xero_invoice_id);
      }
    }

    // ---- Local cleanup
    for (const px of pxBikes) {
      for (const table of ['bike_components', 'fulfilment_events', 'bike_collections', 'inspections', 'jobs', 'parts']) {
        const { error: delErr } = await supabase.from(table).delete().eq('bike_id', px.id);
        if (delErr) throw new Error(`QuickBooks reversed, but clearing ${table} for ${px.reference ?? px.id} failed: ${delErr.message}`);
      }
    }

    for (const inv of invoices) {
      if (inv.part_exchange_bike_id) {
        const { error: unlinkErr } = await supabase.from('bikes').update({ part_exchange_invoice_id: null }).eq('id', inv.part_exchange_bike_id);
        if (unlinkErr) throw new Error(unlinkErr.message);
      }
      const { error } = await supabase.from('invoices').delete().eq('id', inv.id);
      if (error) throw new Error(error.message);
    }

    for (const px of pxBikes) {
      const { error } = await supabase.from('bikes').delete().eq('id', px.id);
      if (error) throw new Error(error.message);
    }

    if (bikeId) {
      const { error } = await supabase
        .from('bikes')
        .update({
          status: newStatus,
          sale_price: null,
          sold_at: null,
          delivery_method: null,
        })
        .eq('id', bikeId);
      if (error) throw new Error(error.message);

      // Cancel any outbound delivery booked for the sale.
      await supabase
        .from('bike_collections')
        .update({ status: 'cancelled' })
        .eq('bike_id', bikeId)
        .eq('direction', 'outbound')
        .neq('status', 'cancelled');

      const { data: bikeRow } = await supabase
        .from('bikes')
        .select('business_id')
        .eq('id', bikeId)
        .maybeSingle();

      await supabase.from('fulfilment_events').insert({
        bike_id: bikeId,
        stage: 'ready',
        notes: `Sale reversed by ${profile.id}. ${invoices.length} invoice(s) deleted${pxBikes.length ? `, ${pxBikes.length} part-exchange bike(s) removed` : ''}. Bike set to ${newStatus}.`,
        performed_by: profile.id,
        business_id: (bikeRow as any)?.business_id ?? invoices[0]?.business_id ?? null,
      });

      await logBikeActivity(bikeId, {
        kind: 'sale',
        action: 'reversed',
        summary: `Sale reversed — ${invoices.length} invoice(s) deleted${pxBikes.length ? `, ${pxBikes.length} part-exchange bike(s) removed` : ''}. Bike set to ${newStatus}.`,
        detail: { invoices: invoices.length, part_exchange_bikes: pxBikes.length, new_status: newStatus },
        actorId: profile.id,
      }, (bikeRow as any)?.business_id ?? null);
    }

    return json({
      ok: true,
      invoices_deleted: invoices.length,
      part_exchange_bikes_deleted: pxBikes.length,
      bike_id: bikeId ?? null,
      new_status: bikeId ? newStatus : null,
    });
  } catch (e) {
    const message = (e as Error).message;
    console.error('reverse-sale error', message);
    return json({ error: message }, 500);
  }
});
