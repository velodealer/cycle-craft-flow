// Retrospectively links existing inspections to InspectABike and pulls faults.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import {
  serviceClient, requireRole, iabFetch, normaliseFault, syncBikeStatusFromFaults, rewriteReportUrl, getReportBaseUrl,
} from '../_shared/inspectabike.ts';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/** Pull the inspection id out of a pasted report link. */
function idFromReportUrl(url: string | null): string | null {
  if (!url) return null;
  const match = UUID_RE.exec(url);
  return match ? match[0] : null;
}

async function tryFetch(query: string) {
  try {
    return await iabFetch(`/partner-inspection?${query}`);
  } catch (e) {
    if ((e as any).status === 404) return null;
    throw e;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = serviceClient();
  const reportBase = await getReportBaseUrl(supabase);
  try {
    await requireRole(req, supabase, ['admin', 'owner']);
  } catch (e) {
    return json({ error: (e as Error).message }, (e as any).status === 403 ? 403 : 401);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const offset = Number.isFinite(body.offset) ? Math.max(0, Number(body.offset)) : 0;
    const limit = Number.isFinite(body.limit) ? Math.min(25, Math.max(1, Number(body.limit))) : 8;
    const bikeIds: string[] | null = Array.isArray(body.bike_ids) ? body.bike_ids : null;

    let query = supabase
      .from('inspections')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1);
    if (bikeIds?.length) query = query.in('bike_id', bikeIds);

    const { data: inspections, count, error } = await query;
    if (error) throw new Error(error.message);

    const summary = {
      processed: 0,
      linked: 0,
      already_linked: 0,
      faults_imported: 0,
      not_found: [] as string[],
      failed: [] as { reference: string; error: string }[],
    };

    for (const inspection of inspections || []) {
      summary.processed++;

      const { data: bike } = await supabase
        .from('bikes')
        .select('id, reference, frame_number, serial_number')
        .eq('id', inspection.bike_id)
        .maybeSingle();
      const label = bike?.reference || inspection.bike_id;

      try {
        let result: any = null;
        let wasLinked = !!inspection.external_inspection_id;

        const knownId = inspection.external_inspection_id || idFromReportUrl(inspection.report_url);
        if (knownId) result = await tryFetch(`id=${encodeURIComponent(knownId)}`);
        if (!result && bike?.reference) {
          result = await tryFetch(`reference=${encodeURIComponent(bike.reference)}`);
        }
        if (!result && (bike?.frame_number || bike?.serial_number)) {
          const serial = bike.frame_number || bike.serial_number;
          result = await tryFetch(`serial=${encodeURIComponent(serial)}`);
        }

        if (!result) {
          summary.not_found.push(label);
          continue;
        }

        const remote = result?.inspection ?? {};
        const faults: any[] = Array.isArray(result?.faults) ? result.faults : [];
        const stolen = result?.stolen_status ?? remote?.stolen_status ?? null;
        const remoteStatus = String(remote?.status ?? '').toLowerCase();
        const completed = ['completed', 'complete', 'finished', 'submitted'].includes(remoteStatus);
        const externalId = remote?.id ? String(remote.id) : knownId;

        const { error: updateError } = await supabase
          .from('inspections')
          .update({
            external_inspection_id: externalId,
            external_reference: inspection.external_reference ?? bike?.reference ?? null,
            report_url: rewriteReportUrl(remote?.report_url ?? null, reportBase) ?? inspection.report_url,
            overall_grade: remote?.overall_grade ?? inspection.overall_grade,
            inspector_name: remote?.inspector_name ?? inspection.inspector_name,
            stolen_status: typeof stolen === 'string'
              ? stolen
              : stolen ? JSON.stringify(stolen) : inspection.stolen_status,
            has_issues: faults.length > 0 || inspection.has_issues,
            status: completed ? 'completed' : inspection.status,
            completed_at: completed
              ? (inspection.completed_at ?? new Date().toISOString())
              : inspection.completed_at,
            synced_at: new Date().toISOString(),
          })
          .eq('id', inspection.id);
        if (updateError) throw new Error(updateError.message);

        if (wasLinked) summary.already_linked++;
        else if (externalId) summary.linked++;

        const rows = faults
          .map((f) => normaliseFault(f, inspection.id, inspection.bike_id, undefined, (inspection as any).business_id))
          .filter((r) => r.external_fault_id);
        if (rows.length) {
          const { error: faultError } = await supabase
            .from('inspection_faults')
            .upsert(rows, { onConflict: 'external_fault_id' });
          if (faultError) throw new Error(faultError.message);
          summary.faults_imported += rows.length;
        }

        await syncBikeStatusFromFaults(supabase, inspection.bike_id, completed);
      } catch (e) {
        summary.failed.push({ reference: label, error: (e as Error).message });
      }
    }

    const nextOffset = offset + (inspections?.length || 0);
    const done = !inspections?.length || nextOffset >= (count ?? nextOffset);

    return json({ success: true, ...summary, total: count ?? nextOffset, next_offset: nextOffset, done });
  } catch (e) {
    const status = (e as any).status && (e as any).status !== 401 ? (e as any).status : 500;
    console.error('inspectabike-backfill failed:', (e as Error).message);
    return json({ error: (e as Error).message }, status);
  }
});
