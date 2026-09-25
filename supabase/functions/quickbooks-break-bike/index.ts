// Posts a bike break to QuickBooks: reclass journal moving kept parts from bike
// stock to parts stock (when mapped) and writing the scrapped remainder off to
// COGS. The kept values are read from the parts the break created — never from
// the client.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import {
  serviceClient, requireUser, getQboAuth, qboFetch, ensureCapabilities, requireCapability,
  logIntegrationError, qboErrorInfo,
} from '../_shared/quickbooks.ts';
import { profileFor } from '../_shared/xero.ts';
import { buildBreakJournalLines } from '../_shared/quickbooks-lines.ts';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const r2 = (n: number) => Math.round(n * 100) / 100;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const supabase = serviceClient();
  let bikeId: string | undefined;
  try {
    const user = await requireUser(req, supabase);
    await profileFor(supabase, user.id);

    const body = await req.json().catch(() => ({}));
    bikeId = typeof body.bike_id === 'string' && UUID_RE.test(body.bike_id) ? body.bike_id : undefined;
    if (!bikeId) return json({ error: 'bike_id is required' }, 400);

    const { data: bike, error } = await supabase.from('bikes')
      .select('id, reference, purchase_price, status, break_qb_posting_id')
      .eq('id', bikeId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!bike) return json({ error: 'Bike not found' }, 404);
    if (bike.break_qb_posting_id) return json({ ok: true, skipped: 'Already posted', qb_journal_id: bike.break_qb_posting_id });

    const { data: integ } = await supabase.from('integrations').select('is_active').eq('name', 'quickbooks').maybeSingle();
    if (!integ?.is_active) return json({ ok: true, skipped: 'QuickBooks is not connected' });

    // Kept parts are the in-stock inventory rows the break created.
    const { data: keptParts, error: pErr } = await supabase.from('parts')
      .select('description, cost_price')
      .eq('stripped_from_bike_id', bikeId)
      .eq('stock_status', 'in_stock');
    if (pErr) throw new Error(`Could not read kept parts: ${pErr.message}`);
    const keptItems = (keptParts ?? [])
      .map((p) => ({ label: String(p.description || 'Part'), amount: r2(Number(p.cost_price || 0)) }))
      .filter((i) => i.amount > 0);
    if (keptItems.length === 0) return json({ ok: true, skipped: 'No kept parts to reclassify' });

    // Basis is the purchase price posted to the accounts at intake. A bike that
    // only had some parts removed (not split) keeps its remaining value — no write-off.
    const isSplit = bike.status === 'split_for_parts';
    const purchase = r2(Number(bike.purchase_price || 0));
    const keptTotal = r2(keptItems.reduce((s, i) => s + i.amount, 0));
    const writtenOff = isSplit ? r2(Math.max(0, purchase - keptTotal)) : 0;

    const { accessToken, realmId, settings } = await getQboAuth(supabase);
    const capabilities = await ensureCapabilities(supabase, settings);
    const accounts = settings.accounts ?? {};
    const needsAccounts = ['stock', ...(writtenOff > 0 ? ['cogs'] : []), ...(accounts.parts_stock ? [] : [])];
    requireCapability(capabilities, { journalEntries: true, accounts: needsAccounts });

    const ref = bike.reference || bike.id.slice(0, 8);
    const lines = buildBreakJournalLines(keptItems, writtenOff, accounts, ref);
    if (lines.length === 0) return json({ ok: true, skipped: 'No parts stock account mapped — kept value stays in stock' });

    const privateNote = [
      `Bike ${ref} broken for parts`,
      ...keptItems.map((i) => `${i.label} ${i.amount.toFixed(2)}`),
      ...(writtenOff > 0 ? [`Written off ${writtenOff.toFixed(2)}`] : []),
    ].join(' | ').slice(0, 2000);

    const journalRes = await qboFetch(accessToken, realmId, '/journalentry?minorversion=75', {
      method: 'POST',
      body: JSON.stringify({
        DocNumber: `BRK-${ref}`.slice(0, 21),
        TxnDate: new Date().toISOString().slice(0, 10),
        PrivateNote: privateNote,
        Line: lines,
      }),
    });
    const journalId = journalRes?.JournalEntry?.Id;
    if (!journalId) throw new Error('QuickBooks did not return the journal entry');

    const { error: recErr } = await supabase.from('bikes').update({
      break_qb_posting_id: journalId, break_qb_sync_status: 'synced', break_qb_sync_error: null,
    }).eq('id', bikeId);
    if (recErr) {
      console.error(`POSTED BUT NOT RECORDED: QuickBooks break journal ${journalId} for ${bikeId}: ${recErr.message}`);
      return json({ error: `Posted to QuickBooks but VeloDealer could not record it: ${recErr.message}. Do not re-run.`, posted: true }, 500);
    }
    return json({ ok: true, qb_journal_id: journalId, kept_total: keptTotal, written_off: writtenOff });
  } catch (e) {
    const info = qboErrorInfo(e);
    const message = (e as Error).message;
    console.error('quickbooks-break-bike error', message);
    if (bikeId) await supabase.from('bikes').update({ break_qb_sync_status: 'failed', break_qb_sync_error: message }).eq('id', bikeId);
    await logIntegrationError(supabase, {
      integration: 'quickbooks', operation: 'bike.break', entity_ref: bikeId ?? null,
      status: info.status, intuit_tid: info.intuitTid, message,
    });
    return json({ error: message }, 500);
  }
});
