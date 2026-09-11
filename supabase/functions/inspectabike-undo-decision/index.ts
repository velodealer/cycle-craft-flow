// Reverts a local approve/decline on an InspectABike fault back to awaiting approval.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { serviceClient, requireRole, syncBikeStatusFromFaults } from '../_shared/inspectabike.ts';

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
    await requireRole(req, supabase, ['admin', 'owner']);
  } catch (e) {
    return json({ error: (e as Error).message }, (e as any).status === 403 ? 403 : 401);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const faultRowId = typeof body.fault_row_id === 'string' ? body.fault_row_id : '';
    if (!UUID_RE.test(faultRowId)) return json({ error: 'Invalid fault_row_id' }, 400);

    const { data: fault, error: faultError } = await supabase
      .from('inspection_faults')
      .select('*')
      .eq('id', faultRowId)
      .maybeSingle();
    if (faultError) throw new Error(faultError.message);
    if (!fault) return json({ error: 'Fault not found' }, 404);

    if (!['approved', 'declined', 'awaiting_part'].includes(fault.status)) {
      return json({ error: 'Only approved or declined repairs can be undone' }, 400);
    }

    // Remove the cost records this decision created, when they are untouched.
    if (fault.part_id) {
      await supabase.from('parts').delete().eq('id', fault.part_id).eq('stock_status', 'in_stock');
    }
    if (fault.job_id) {
      await supabase.from('jobs').delete().eq('id', fault.job_id).eq('status', 'pending');
    }

    const { data: updated, error: updateError } = await supabase
      .from('inspection_faults')
      .update({
        status: 'reported',
        decision_note: null,
        decided_by: null,
        decided_at: null,
        repaired_at: null,
        part_id: null,
        job_id: null,
      })
      .eq('id', fault.id)
      .select()
      .single();
    if (updateError) throw new Error(updateError.message);

    const { data: inspection } = await supabase
      .from('inspections')
      .select('status')
      .eq('id', fault.inspection_id)
      .maybeSingle();

    await syncBikeStatusFromFaults(supabase, fault.bike_id, inspection?.status === 'completed');

    return json({ success: true, fault: updated });
  } catch (e) {
    console.error('inspectabike-undo-decision failed:', (e as Error).message);
    return json({ error: (e as Error).message }, 500);
  }
});
