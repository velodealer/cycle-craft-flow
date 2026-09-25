// Posts a part fitted to a bike: Dr stock / Cr parts stock for the part's cost
// (read server-side). No-op when no Parts stock account is mapped.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import {
  serviceClient, requireUser, getQboAuth, qboFetch, logIntegrationError, qboErrorInfo,
} from '../_shared/quickbooks.ts';
import { profileFor } from '../_shared/xero.ts';
import { buildFitPartLines } from '../_shared/quickbooks-lines.ts';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const supabase = serviceClient();
  let partId: string | undefined;
  try {
    const user = await requireUser(req, supabase);
    const profile = await profileFor(supabase, user.id);
    const body = await req.json().catch(() => ({}));
    partId = typeof body.part_id === 'string' && UUID_RE.test(body.part_id) ? body.part_id : undefined;
    if (!partId) return json({ error: 'part_id is required' }, 400);

    const { data: part, error } = await supabase.from('parts')
      .select('id, business_id, bike_id, description, brand, cost_price, fit_qb_posting_id, bikes:bike_id(reference)')
      .eq('id', partId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!part || part.business_id !== profile.business_id || !part.bike_id) return json({ error: 'Fitted part not found' }, 404);
    if (part.fit_qb_posting_id) return json({ ok: true, skipped: 'Already posted' });

    const { data: integ } = await supabase.from('integrations').select('is_active').eq('name', 'quickbooks').maybeSingle();
    if (!integ?.is_active) return json({ ok: true, skipped: 'QuickBooks is not connected' });

    const { accessToken, realmId, settings } = await getQboAuth(supabase);
    const ref = (part as any).bikes?.reference || part.bike_id.slice(0, 8);
    const description = `${[part.brand, part.description].filter(Boolean).join(' ')} → ${ref}`;
    const lines = buildFitPartLines(Number(part.cost_price || 0), settings.accounts ?? {}, description);
    if (lines.length === 0) return json({ ok: true, skipped: 'No parts stock account mapped — value already in stock' });

    const res = await qboFetch(accessToken, realmId, '/journalentry?minorversion=75', {
      method: 'POST',
      body: JSON.stringify({
        DocNumber: `FIT-${ref}`.slice(0, 21),
        TxnDate: new Date().toISOString().slice(0, 10),
        PrivateNote: description.slice(0, 2000),
        Line: lines,
      }),
    });
    const journalId = res?.JournalEntry?.Id;
    if (!journalId) throw new Error('QuickBooks did not return the journal entry');
    const { error: recErr } = await supabase.from('parts').update({
      fit_qb_posting_id: journalId, fit_qb_sync_status: 'synced', fit_qb_sync_error: null,
    }).eq('id', partId);
    if (recErr) return json({ error: `Posted to QuickBooks but not recorded: ${recErr.message}. Do not re-run.`, posted: true }, 500);
    return json({ ok: true, qb_journal_id: journalId });
  } catch (e) {
    const info = qboErrorInfo(e);
    const message = (e as Error).message;
    if (partId) await supabase.from('parts').update({ fit_qb_sync_status: 'failed', fit_qb_sync_error: message }).eq('id', partId);
    await logIntegrationError(supabase, {
      integration: 'quickbooks', operation: 'part.fit', entity_ref: partId ?? null,
      status: info.status, intuit_tid: info.intuitTid, message,
    });
    return json({ error: message }, 500);
  }
});
