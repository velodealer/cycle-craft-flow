// Creates (idempotently) an InspectABike inspection for a bike and stores the link.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { serviceClient, requireRole, iabFetch, mapBikeType, rewriteReportUrl, getReportBaseUrl } from '../_shared/inspectabike.ts';

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
    const bikeId = typeof body.bike_id === 'string' ? body.bike_id : '';
    if (!UUID_RE.test(bikeId)) return json({ error: 'Invalid bike_id' }, 400);

    const { data: bike, error: bikeError } = await supabase
      .from('bikes')
      .select('*')
      .eq('id', bikeId)
      .maybeSingle();
    if (bikeError) throw new Error(bikeError.message);
    if (!bike) return json({ error: 'Bike not found' }, 404);

    // Find or create the local inspection row.
    let { data: inspection } = await supabase
      .from('inspections')
      .select('*')
      .eq('bike_id', bikeId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!inspection) {
      const { data: created, error } = await supabase
        .from('inspections')
        .insert({ bike_id: bikeId, inspected_by: profile.id, status: 'in_progress', business_id: (bike as any).business_id })
        .select()
        .single();
      if (error) throw new Error(error.message);
      inspection = created;
    }

    const reference = bike.reference || `BIKE-${bike.id.slice(0, 8)}`;

    // Customer name: external owner if we have one, otherwise the trading name.
    let customerName = 'Cycle Craft Flow';
    if (bike.external_owner_id) {
      const { data: owner } = await supabase
        .from('external_owners')
        .select('name')
        .eq('id', bike.external_owner_id)
        .maybeSingle();
      if (owner?.name) customerName = owner.name;
    }

    const payload = {
      reference,
      serial_number: bike.frame_number || bike.serial_number || reference,
      bike_make: bike.make,
      bike_model: bike.model,
      bike_type: mapBikeType(bike),
      bike_year: bike.year ?? null,
      customer_name: customerName,
      notes: bike.condition_notes || null,
    };

    const result = await iabFetch('/partner-create-inspection', {
      method: 'POST',
      body: JSON.stringify(payload),
    }, { supabase, businessId: (bike as any).business_id });

    const externalId = result?.inspection_id ?? result?.inspection?.id ?? null;
    const reportUrl = rewriteReportUrl(result?.report_url ?? result?.inspection?.report_url ?? null, await getReportBaseUrl(supabase));

    const { data: updated, error: updateError } = await supabase
      .from('inspections')
      .update({
        external_inspection_id: externalId ? String(externalId) : null,
        external_reference: reference,
        report_url: reportUrl,
        status: 'in_progress',
        synced_at: new Date().toISOString(),
      })
      .eq('id', inspection.id)
      .select()
      .single();
    if (updateError) throw new Error(updateError.message);

    return json({ success: true, inspection: updated });
  } catch (e) {
    const status = (e as any).status && (e as any).status !== 401 ? (e as any).status : 500;
    console.error('inspectabike-create failed:', (e as Error).message);
    return json({ error: (e as Error).message }, status);
  }
});
