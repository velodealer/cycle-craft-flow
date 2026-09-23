// Creates (idempotently) an InspectABike inspection for a bike and stores the link.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { serviceClient, requireRole, iabFetch, mapBikeType } from '../_shared/inspectabike.ts';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// InspectABike field name -> our bike column.
const FIELD_MAP: Record<string, string> = {
  bike_year: 'year', serial_number: 'frame_number', bike_make: 'make', bike_model: 'model',
};

function plain(msg: string, field: string) {
  if (/expected string|expected number|invalid/i.test(msg)) return `Please check the ${field.replace('_', ' ')} and try again`;
  return msg;
}

/** Pull a {field: [messages]} map out of an InspectABike error body. */
function fieldErrors(b: any): { field: string; message: string }[] {
  const out: { field: string; message: string }[] = [];
  const candidates = [b, b?.error, b?.details, b?.errors, b?.error?.details];
  for (const c of candidates) {
    if (!c || typeof c !== 'object' || Array.isArray(c)) continue;
    for (const [k, v] of Object.entries(c)) {
      const col = FIELD_MAP[k];
      if (!col) continue;
      const msg = Array.isArray(v) ? String(v[0] ?? '') : typeof v === 'string' ? v : '';
      if (!out.some((o) => o.field === col)) out.push({ field: col, message: plain(msg, col) });
    }
  }
  return out;
}

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

    // Customer name: external owner if we have one, otherwise the dealership
    // plus the staff member who started the inspection.
    let businessName = '';
    if ((bike as any).business_id) {
      const { data: business } = await supabase
        .from('businesses')
        .select('name')
        .eq('id', (bike as any).business_id)
        .maybeSingle();
      businessName = (business as any)?.name?.trim() || '';
    }
    const staffName = (profile as any)?.name?.trim() || '';
    let customerName = businessName && staffName
      ? `${businessName} (${staffName})`
      : businessName || staffName || 'VeloDealer';

    if (bike.external_owner_id) {
      const { data: owner } = await supabase
        .from('external_owners')
        .select('name')
        .eq('id', bike.external_owner_id)
        .maybeSingle();
      if (owner?.name) customerName = owner.name;
    }

    const str = (v: unknown) => {
      if (v === null || v === undefined) return null;
      const s = String(v).trim();
      return s ? s : null;
    };

    // Ask the user for anything InspectABike needs before sending.
    const missing: { field: string; message: string }[] = [];
    if (!str(bike.make)) missing.push({ field: 'make', message: 'Make is required' });
    if (!str(bike.model)) missing.push({ field: 'model', message: 'Model is required' });
    if (!str(bike.frame_number) && !str(bike.serial_number)) missing.push({ field: 'frame_number', message: 'Frame number is required' });
    if (missing.length) return json({ error: 'Some bike details are missing', code: 'MISSING_FIELDS', fields: missing }, 422);

    const payload = {
      reference,
      serial_number: str(bike.frame_number) || str(bike.serial_number) || reference,
      bike_make: str(bike.make),
      bike_model: str(bike.model),
      bike_type: mapBikeType(bike),
      bike_year: str(bike.year),
      customer_name: customerName,
      notes: str(bike.condition_notes),
    };

    let result: any;
    try {
      result = await iabFetch('/partner-create-inspection', {
        method: 'POST',
        body: JSON.stringify(payload),
      }, { supabase, businessId: (bike as any).business_id });
    } catch (err) {
      // Duplicate: reuse the existing inspection if InspectABike tells us which one.
      const b = (err as any).body;
      const existingId = b?.inspection_id ?? b?.inspection?.id ?? b?.existing_inspection_id ?? b?.error?.inspection_id;
      if ((err as any).status === 409 && existingId) result = { inspection_id: existingId, report_url: b?.report_url ?? b?.inspection?.report_url ?? b?.error?.report_url };
      else {
        const fields = fieldErrors(b);
        if (fields.length) return json({ error: 'InspectABike needs some bike details corrected', code: 'INVALID_FIELDS', fields }, 422);
        throw err;
      }
    }

    const externalId = result?.inspection_id ?? result?.inspection?.id ?? null;
    const reportUrl = result?.report_url ?? result?.inspection?.report_url ?? null;

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
