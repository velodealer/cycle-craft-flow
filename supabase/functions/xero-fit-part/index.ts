// Posts a part fitted to a bike to Xero: Dr stock / Cr parts stock (server-read cost).
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { serviceClient, requireUser, profileFor, getXeroAuth, xeroFetch, logXeroError } from '../_shared/xero.ts';
import { fitPartJournalLines } from '../_shared/xero-postings.ts';

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
  let partId: string | undefined;
  try {
    const body = await req.json().catch(() => ({}));
    partId = typeof body.part_id === 'string' && UUID_RE.test(body.part_id) ? body.part_id : undefined;
    if (!partId) return json({ error: 'part_id is required' }, 400);
    const reverse = body.reverse === true;

    const { data: part, error } = await supabase.from('parts')
      .select('id, business_id, bike_id, description, brand, cost_price, fit_xero_posting_id, stock_status, stripped_from_bike_id, bikes:bike_id(reference)')
      .eq('id', partId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!part || part.business_id !== businessId) return json({ error: 'Part not found' }, 404);
    if (reverse) {
      if (part.bike_id || part.stock_status !== 'in_stock') return json({ error: 'Part is not back in stock' }, 409);
      if (!part.fit_xero_posting_id) return json({ ok: true, skipped: 'Fit was never posted — nothing to reverse' });
    } else {
      if (!part.bike_id) return json({ error: 'Fitted part not found' }, 404);
      if (part.fit_xero_posting_id) return json({ ok: true, skipped: 'Already posted' });
    }

    const { data: integ } = await supabase.from('integrations').select('is_active')
      .eq('name', 'xero').eq('business_id', businessId).maybeSingle();
    if (!integ?.is_active) return json({ ok: true, skipped: 'Xero is not connected' });

    const auth = await getXeroAuth(supabase, businessId);
    const ref = (part as any).bikes?.reference || (part.bike_id ?? '').slice(0, 8) || 'STOCK';
    const description = `${[part.brand, part.description].filter(Boolean).join(' ')} → ${ref}`;
    const fitLines = fitPartJournalLines(Number(part.cost_price || 0), auth.settings.accounts ?? {}, description);
    const lines = reverse
      ? fitLines.map((l: any) => ({ ...l, LineAmount: -l.LineAmount, Description: String(l.Description ?? '').replace('Part fitted to bike', 'Part returned to stock') }))
      : fitLines;
    if (lines.length === 0) return json({ ok: true, skipped: 'No parts stock account mapped — value already in stock' });

    const res = await xeroFetch(auth, '/ManualJournals', {
      method: 'POST',
      body: JSON.stringify({ ManualJournals: [{
        Narration: description.slice(0, 4000), Date: new Date().toISOString().slice(0, 10), Status: 'POSTED', JournalLines: lines,
      }] }),
    });
    const journalId = res?.ManualJournals?.[0]?.ManualJournalID;
    if (!journalId) throw new Error('Xero did not return the journal');
    const { error: recErr } = await supabase.from('parts').update({
      fit_xero_posting_id: reverse ? null : journalId, fit_xero_sync_status: reverse ? 'reversed' : 'synced', fit_xero_sync_error: null,
    }).eq('id', partId);
    if (recErr) return json({ error: `Posted to Xero but not recorded: ${recErr.message}. Do not re-run.`, posted: true }, 500);
    return json({ ok: true, xero_journal_id: journalId });
  } catch (e) {
    const message = (e as Error).message;
    if (partId) await supabase.from('parts').update({ fit_xero_sync_status: 'failed', fit_xero_sync_error: message }).eq('id', partId);
    await logXeroError(supabase, 'part.fit', partId ?? null, message, (e as { status?: number }).status ?? null);
    return json({ error: message }, 500);
  }
});
