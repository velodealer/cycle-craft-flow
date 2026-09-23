// Pulls the latest inspection state and faults from InspectABike.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import {
  serviceClient, requireRole, iabFetch, normaliseFault, syncBikeStatusFromFaults, upsertFaults,
} from '../_shared/inspectabike.ts';
import { notifyFaultsAwaitingApproval } from '../_shared/email.ts';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = serviceClient();
  try {
    await requireRole(req, supabase, ['admin', 'owner', 'mechanic', 'accountant']);
  } catch (e) {
    return json({ error: (e as Error).message }, (e as any).status === 403 ? 403 : 401);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const bikeId = typeof body.bike_id === 'string' ? body.bike_id : '';
    if (!UUID_RE.test(bikeId)) return json({ error: 'Invalid bike_id' }, 400);

    const { data: inspection } = await supabase
      .from('inspections')
      .select('*')
      .eq('bike_id', bikeId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!inspection) return json({ error: 'No inspection record for this bike' }, 404);
    if (!inspection.external_inspection_id && !inspection.external_reference) {
      return json({ error: 'This bike has not been sent to InspectABike yet' }, 400);
    }

    const { data: bikeRow } = await supabase.from('bikes').select('reference').eq('id', bikeId).maybeSingle();
    const ctx = { supabase, businessId: (inspection as any).business_id };
    const attempts: string[] = [];
    const extId = inspection.external_inspection_id;
    if (extId) attempts.push(`id=${encodeURIComponent(extId)}`, `report_id=${encodeURIComponent(extId)}`);
    for (const ref of [inspection.external_reference, (bikeRow as any)?.reference]) {
      if (ref) attempts.push(`reference=${encodeURIComponent(ref)}`);
    }
    let result: any = null;
    let lastErr: any = null;
    for (const q of [...new Set(attempts)]) {
      try {
        result = await iabFetch(`/partner-inspection?${q}`, {}, ctx);
        console.log(`inspectabike-sync: found via ${q}`);
        break;
      } catch (e) {
        lastErr = e;
        if ((e as any).status && (e as any).status !== 404 && (e as any).status !== 400) throw e;
      }
    }
    if (!result) {
      throw Object.assign(
        new Error(`${(lastErr as Error)?.message || 'Inspection not found in InspectABike'} — check the inspection ID in Edit link`),
        { status: 404 },
      );
    }
    const remote = result?.inspection ?? {};
    const faults: any[] = Array.isArray(result?.faults) ? result.faults : [];
    const { count: priorCount } = await supabase
      .from('inspection_faults').select('id', { count: 'exact', head: true }).eq('inspection_id', inspection.id);
    const emptyButHadIssues = faults.length === 0 && (inspection.has_issues || (priorCount ?? 0) > 0);
    const stolen = result?.stolen_status ?? remote?.stolen_status ?? null;

    const remoteStatus = String(remote?.status ?? '').toLowerCase();
    const completed = ['completed', 'complete', 'finished', 'submitted'].includes(remoteStatus);

    const { data: updated, error: updateError } = await supabase
      .from('inspections')
      .update({
        external_inspection_id: remote?.id ? String(remote.id) : inspection.external_inspection_id,
        report_url: remote?.report_url ?? inspection.report_url,
        overall_grade: remote?.overall_grade ?? null,
        inspector_name: remote?.inspector_name ?? null,
        stolen_status: typeof stolen === 'string' ? stolen : stolen ? JSON.stringify(stolen) : null,
        has_issues: faults.length > 0 || emptyButHadIssues,
        status: completed ? 'completed' : inspection.status,
        completed_at: completed ? (inspection.completed_at ?? new Date().toISOString()) : inspection.completed_at,
        synced_at: new Date().toISOString(),
      })
      .eq('id', inspection.id)
      .select()
      .single();
    if (updateError) throw new Error(updateError.message);

    let saved = 0;
    if (faults.length) {
      const extId = String(remote?.id ?? inspection.external_inspection_id ?? inspection.id);
      console.log('inspectabike-sync fault keys:', JSON.stringify(Object.keys(faults[0] ?? {})));
      const rows = faults
        .map((f, i) => normaliseFault(f, inspection.id, bikeId, undefined, (inspection as any).business_id, `${extId}:${i}`))
        .filter((r) => r.external_fault_id);
      const { data: known } = await supabase
        .from('inspection_faults')
        .select('external_fault_id')
        .eq('bike_id', bikeId);
      const knownIds = new Set((known ?? []).map((k: any) => k.external_fault_id));
      await upsertFaults(supabase, rows);
      saved = rows.length;
      const freshFaults = rows.filter((r) => !knownIds.has(r.external_fault_id));
      if (freshFaults.length) await notifyFaultsAwaitingApproval(supabase, bikeId, freshFaults);
    }
    console.log(`inspectabike-sync: received ${faults.length}, saved ${saved}`);

    const { count } = await supabase
      .from('inspection_faults').select('id', { count: 'exact', head: true }).eq('inspection_id', inspection.id);
    await supabase.from('inspections').update({ has_issues: (count ?? 0) > 0 }).eq('id', inspection.id);

    await syncBikeStatusFromFaults(supabase, bikeId, completed);

    if (saved < faults.length) {
      return json({ error: `InspectABike sent ${faults.length} faults but only ${saved} could be saved` }, 500);
    }
    return json({ success: true, inspection: updated, fault_count: faults.length });
  } catch (e) {
    const status = (e as any).status && (e as any).status !== 401 ? (e as any).status : 500;
    console.error('inspectabike-sync failed:', (e as Error).message);
    return json({ error: (e as Error).message }, status);
  }
});
