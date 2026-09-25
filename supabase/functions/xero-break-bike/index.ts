// Posts a bike break to Xero: reclass journal moving kept parts from bike stock
// to parts stock (when mapped) and writing the scrapped remainder off to COGS.
// The kept values are read from the parts the break created — never from the client.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import {
  serviceClient, requireUser, profileFor, getXeroAuth, xeroFetch, logXeroError, stockInRef,
} from '../_shared/xero.ts';
import { breakJournalLines } from '../_shared/xero-postings.ts';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const r2 = (n: number) => Math.round(n * 100) / 100;

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
      .select('id, business_id, reference, purchase_price, status')
      .eq('id', bikeId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!bike || bike.business_id !== businessId) return json({ error: 'Bike not found' }, 404);

    const { data: integ, error: iErr } = await supabase.from('integrations').select('is_active')
      .eq('name', 'xero').eq('business_id', businessId).maybeSingle();
    if (iErr) throw new Error(iErr.message);
    if (!integ?.is_active) return json({ ok: true, skipped: 'Xero is not connected' });

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

    // Basis is the purchase price posted to the accounts at intake.
    const purchase = r2(Number(bike.purchase_price || 0));
    const keptTotal = r2(keptItems.reduce((s, i) => s + i.amount, 0));
    const writtenOff = bike.status === 'split_for_parts' ? r2(Math.max(0, purchase - keptTotal)) : 0;

    const auth = await getXeroAuth(supabase, businessId);
    const call = (p: string, init?: RequestInit) => xeroFetch(auth, p, init);
    const ref = bike.reference || bike.id.slice(0, 8);
    const lines = breakJournalLines(keptItems, writtenOff, auth.settings.accounts ?? {}, ref);
    if (lines.length === 0) return json({ ok: true, skipped: 'No parts stock account mapped — kept value stays in stock' });

    const narration = [
      `Bike ${ref} broken for parts`,
      ...keptItems.map((i) => `${i.label} ${i.amount.toFixed(2)}`),
      ...(writtenOff > 0 ? [`Written off ${writtenOff.toFixed(2)}`] : []),
      `Stock in journal: ${stockInRef(ref) ?? '—'}`,
    ].join(' | ').slice(0, 4000);

    const mjRes = await call('/ManualJournals', {
      method: 'POST',
      body: JSON.stringify({
        ManualJournals: [{
          Narration: narration,
          Date: new Date().toISOString().slice(0, 10),
          Status: 'POSTED',
          JournalLines: lines,
        }],
      }),
    });
    const journalId = mjRes?.ManualJournals?.[0]?.ManualJournalID;
    if (!journalId) throw new Error('Xero did not return the journal');

    const { error: recErr } = await supabase.from('bikes').update({
      break_xero_posting_id: journalId, break_xero_sync_status: 'synced', break_xero_sync_error: null,
    }).eq('id', bikeId);
    if (recErr) {
      console.error(`POSTED BUT NOT RECORDED: Xero break journal ${journalId} for ${bikeId}: ${recErr.message}`);
      return json({ error: `Posted to Xero but VeloDealer could not record it: ${recErr.message}. Do not re-run.`, posted: true }, 500);
    }
    return json({ ok: true, xero_journal_id: journalId, kept_total: keptTotal, written_off: writtenOff });
  } catch (e) {
    const message = (e as Error).message;
    console.error('xero-break-bike error', message);
    if (bikeId) await supabase.from('bikes').update({ break_xero_sync_status: 'failed', break_xero_sync_error: message }).eq('id', bikeId);
    await logXeroError(supabase, 'bike.break', bikeId ?? null, message, (e as { status?: number }).status ?? null);
    return json({ error: message }, 500);
  }
});
