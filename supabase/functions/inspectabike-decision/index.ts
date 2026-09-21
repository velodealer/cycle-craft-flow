// Approves or declines an InspectABike fault and mirrors the decision locally.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { serviceClient, requireRole, iabFetch, syncBikeStatusFromFaults } from '../_shared/inspectabike.ts';
import { logBikeActivity } from '../_shared/activity.ts';

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
    ({ profile } = await requireRole(req, supabase, ['admin', 'owner']));
  } catch (e) {
    return json({ error: (e as Error).message }, (e as any).status === 403 ? 403 : 401);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const faultRowId = typeof body.fault_row_id === 'string' ? body.fault_row_id : '';
    const decision = body.decision === 'approved' || body.decision === 'declined' ? body.decision : null;
    const note = typeof body.note === 'string' && body.note.trim() ? body.note.trim().slice(0, 1000) : undefined;

    if (!UUID_RE.test(faultRowId)) return json({ error: 'Invalid fault_row_id' }, 400);
    if (!decision) return json({ error: 'decision must be approved or declined' }, 400);

    const { data: fault, error: faultError } = await supabase
      .from('inspection_faults')
      .select('*')
      .eq('id', faultRowId)
      .maybeSingle();
    if (faultError) throw new Error(faultError.message);
    if (!fault) return json({ error: 'Fault not found' }, 404);

    // Who made the decision: staff member plus their dealership.
    let businessName = '';
    if ((fault as any).business_id) {
      const { data: business } = await supabase
        .from('businesses')
        .select('name')
        .eq('id', (fault as any).business_id)
        .maybeSingle();
      businessName = (business as any)?.name?.trim() || '';
    }
    const staffName = (profile as any)?.name?.trim() || '';
    const actorName = staffName && businessName
      ? `${staffName} — ${businessName}`
      : staffName || businessName || 'VeloDealer';

    // Tell InspectABike first — they own the pricing and fault state.
    const remote = await iabFetch('/partner-fault-decision', {
      method: 'POST',
      body: JSON.stringify({
        fault_id: fault.external_fault_id,
        decision,
        ...(note ? { note } : {}),
        actor_name: actorName,
      }),
    }, { supabase, businessId: (fault as any).business_id });

    // Adopt the status InspectABike returns when it supplies one, so both sides agree.
    const remoteStatus = String(
      remote?.status ?? remote?.fault?.status ?? decision,
    ).toLowerCase();
    const effectiveStatus = ['approved', 'declined', 'awaiting_part', 'repaired', 'reported']
      .includes(remoteStatus) ? remoteStatus : decision;

    const update: Record<string, unknown> = {
      status: effectiveStatus,
      decision_note: note ?? null,
      decided_by: profile.id,
      decided_at: new Date().toISOString(),
      ...(effectiveStatus === 'repaired' ? { repaired_at: new Date().toISOString() } : {}),
    };

    if (decision === 'approved') {
      const label = fault.component ? `${fault.component} — ${fault.title}` : fault.title;

      if (!fault.part_id && Number(fault.parts_cost) > 0) {
        const { data: part } = await supabase
          .from('parts')
          .insert({
            type: 'new_fitted',
            description: `${label} (inspection)`,
            cost_price: Number(fault.parts_cost),
            quantity: 1,
            stock_status: 'in_stock',
            bike_id: fault.bike_id,
            business_id: (fault as any).business_id,
          })
          .select('id')
          .single();
        if (part) update.part_id = part.id;
      }

      if (!fault.job_id && Number(fault.labour_cost) > 0) {
        const { data: job } = await supabase
          .from('jobs')
          .insert({
            bike_id: fault.bike_id,
            type: 'workshop',
            title: `${label} (inspection)`,
            description: fault.description,
            estimated_cost: Number(fault.labour_cost),
            actual_cost: Number(fault.labour_cost),
            status: 'pending',
            business_id: (fault as any).business_id,
          })
          .select('id')
          .single();
        if (job) update.job_id = job.id;
      }
    }

    const { data: updated, error: updateError } = await supabase
      .from('inspection_faults')
      .update(update)
      .eq('id', fault.id)
      .select()
      .single();
    if (updateError) throw new Error(updateError.message);

    const { data: inspection } = await supabase
      .from('inspections')
      .select('status')
      .eq('id', fault.inspection_id)
      .maybeSingle();

    await logBikeActivity(fault.bike_id, {
      kind: 'inspection',
      action: decision,
      summary: `Fault ${decision}: ${fault.title}`,
      detail: { note: note ?? null, status: effectiveStatus },
      actorId: (profile as any)?.id ?? null,
      actorLabel: actorName,
    }, (fault as any).business_id);

    await syncBikeStatusFromFaults(supabase, fault.bike_id, inspection?.status === 'completed');

    return json({ success: true, fault: updated });
  } catch (e) {
    const status = (e as any).status && (e as any).status !== 401 ? (e as any).status : 500;
    console.error('inspectabike-decision failed:', (e as Error).message);
    return json({ error: (e as Error).message }, status);
  }
});
