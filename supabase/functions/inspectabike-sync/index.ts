// Pulls the latest inspection state and faults from InspectABike.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import {
  serviceClient, requireRole, iabFetch, normaliseFault, syncBikeStatusFromFaults, upsertFaults, rewriteReportUrl, getReportBaseUrl,
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
  const reportBase = await getReportBaseUrl(supabase);
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

    const query = inspection.external_inspection_id
      ? `id=${encodeURIComponent(inspection.external_inspection_id)}`
      : `reference=${encodeURIComponent(inspection.external_reference)}`;

    const result = await iabFetch(`/partner-inspection?${query}`);
    const remote = result?.inspection ?? {};
    const faults: any[] = Array.isArray(result?.faults) ? result.faults : [];
    const stolen = result?.stolen_status ?? remote?.stolen_status ?? null;

    const remoteStatus = String(remote?.status ?? '').toLowerCase();
    const completed = ['completed', 'complete', 'finished', 'submitted'].includes(remoteStatus);

    const { data: updated, error: updateError } = await supabase
      .from('inspections')
      .update({
        external_inspection_id: remote?.id ? String(remote.id) : inspection.external_inspection_id,
        report_url: rewriteReportUrl(remote?.report_url ?? null, reportBase) ?? inspection.report_url,
        overall_grade: remote?.overall_grade ?? null,
        inspector_name: remote?.inspector_name ?? null,
        stolen_status: typeof stolen === 'string' ? stolen : stolen ? JSON.stringify(stolen) : null,
        has_issues: faults.length > 0,
        status: completed ? 'completed' : inspection.status,
        completed_at: completed ? (inspection.completed_at ?? new Date().toISOString()) : inspection.completed_at,
        synced_at: new Date().toISOString(),
      })
      .eq('id', inspection.id)
      .select()
      .single();
    if (updateError) throw new Error(updateError.message);

    if (faults.length) {
      const rows = faults
        .map((f) => normaliseFault(f, inspection.id, bikeId))
        .filter((r) => r.external_fault_id);
      await upsertFaults(supabase, rows);
    }

    await syncBikeStatusFromFaults(supabase, bikeId, completed);

    return json({ success: true, inspection: updated, fault_count: faults.length });
  } catch (e) {
    const status = (e as any).status && (e as any).status !== 401 ? (e as any).status : 500;
    console.error('inspectabike-sync failed:', (e as Error).message);
    return json({ error: (e as Error).message }, status);
  }
});
