// Marks an InspectABike fault as repaired, then mirrors the completion locally.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { serviceClient, requireRole, iabFetch, syncBikeStatusFromFaults } from '../_shared/inspectabike.ts';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = serviceClient();
  let profile;
  try {
    ({ profile } = await requireRole(req, supabase, ['admin', 'owner', 'mechanic']));
  } catch (e) {
    return json({ error: (e as Error).message }, (e as any).status === 403 ? 403 : 401);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const faultRowId = typeof body.fault_row_id === 'string' ? body.fault_row_id : '';
    const note = typeof body.note === 'string' && body.note.trim()
      ? body.note.trim().slice(0, 1000)
      : undefined;
    if (!UUID_RE.test(faultRowId)) return json({ error: 'Invalid fault_row_id' }, 400);

    const { data: fault, error: faultError } = await supabase
      .from('inspection_faults')
      .select('*')
      .eq('id', faultRowId)
      .maybeSingle();
    if (faultError) throw new Error(faultError.message);
    if (!fault) return json({ error: 'Fault not found' }, 404);

    if (fault.status === 'repaired') {
      return json({ success: true, fault, already: true });
    }
    if (fault.status === 'declined') {
      return json({ error: 'This repair was declined and cannot be marked as done.' }, 400);
    }

    const payload = {
      fault_id: fault.external_fault_id,
      decision: 'repaired',
      status: 'repaired',
      ...(note ? { note } : {}),
      actor_name: profile.name || 'VeloDealer',
    };

    // InspectABike owns fault state: only record it locally once they accept it.
    try {
      await iabFetch('/partner-fault-decision', { method: 'POST', body: JSON.stringify(payload) });
    } catch (e) {
      const status = (e as any).status;
      if (status === 400 || status === 404) {
        // Older/alternate partner API shape.
        await iabFetch('/partner-fault-repaired', { method: 'POST', body: JSON.stringify(payload) });
      } else {
        throw e;
      }
    }

    const now = new Date().toISOString();
    const { data: updated, error: updateError } = await supabase
      .from('inspection_faults')
      .update({
        status: 'repaired',
        repaired_at: now,
        decided_by: fault.decided_by ?? profile.id,
        ...(note ? { decision_note: note } : {}),
      })
      .eq('id', fault.id)
      .select()
      .single();
    if (updateError) throw new Error(updateError.message);

    if (fault.job_id) {
      await supabase
        .from('jobs')
        .update({ status: 'completed', completed_at: now })
        .eq('id', fault.job_id)
        .neq('status', 'completed');
    }

    const { data: inspection } = await supabase
      .from('inspections')
      .select('status')
      .eq('id', fault.inspection_id)
      .maybeSingle();

    await syncBikeStatusFromFaults(supabase, fault.bike_id, inspection?.status === 'completed');

    return json({ success: true, fault: updated });
  } catch (e) {
    const status = (e as any).status && (e as any).status !== 401 ? (e as any).status : 500;
    console.error('inspectabike-complete-repair failed:', (e as Error).message);
    return json({ error: (e as Error).message }, status);
  }
});
