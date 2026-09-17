// Receives fault events from InspectABike. Signature-verified, no JWT.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import {
  serviceClient, normaliseFault, upsertFaults, syncBikeStatusFromFaults, isOpenFault,
} from '../_shared/inspectabike.ts';
import { notifyFaultsAwaitingApproval } from '../_shared/email.ts';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const toHex = (buf: ArrayBuffer) =>
  Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function verify(rawBody: string, signature: string, secret: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody));
  return timingSafeEqual(toHex(sig).toLowerCase(), signature.trim().replace(/^sha256=/i, '').toLowerCase());
}

/** Recompute has_issues from the actual fault rows for this inspection. */
async function recomputeHasIssues(supabase: ReturnType<typeof serviceClient>, inspectionId: string) {
  const { count } = await supabase
    .from('inspection_faults')
    .select('id', { count: 'exact', head: true })
    .eq('inspection_id', inspectionId);
  await supabase
    .from('inspections')
    .update({ has_issues: (count ?? 0) > 0, synced_at: new Date().toISOString() })
    .eq('id', inspectionId);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: { ...corsHeaders, 'Access-Control-Allow-Headers': 'content-type, x-inspectabike-signature' },
    });
  }

  const secret = Deno.env.get('INSPECTABIKE_WEBHOOK_SECRET');
  if (!secret) return json({ error: 'Webhook secret not configured' }, 500);

  const signature = req.headers.get('x-inspectabike-signature') || '';
  const rawBody = await req.text();

  if (!signature || !(await verify(rawBody, signature, secret))) {
    console.error('inspectabike-webhook: invalid signature');
    return json({ error: 'Invalid signature' }, 401);
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const event = String(payload?.event || '');
  const externalInspectionId = payload?.external_inspection_id != null
    ? String(payload.external_inspection_id)
    : '';

  const supabase = serviceClient();

  try {
    if (!externalInspectionId) return json({ received: true });

    const { data: inspection } = await supabase
      .from('inspections')
      .select('id, bike_id, status, completed_at, business_id')
      .or(`external_inspection_id.eq.${externalInspectionId},external_reference.eq.${externalInspectionId}`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!inspection) {
      console.error('inspectabike-webhook: no local inspection for', externalInspectionId);
      return json({ received: true });
    }

    if (event === 'inspection.faults_completed') {
      // All faults are repaired or declined — fires once, but handle idempotently.
      const faults: any[] = Array.isArray(payload?.faults) ? payload.faults : [];
      const rows = faults
        .map((f) => normaliseFault(f, inspection.id, inspection.bike_id, 'fault.updated', inspection.business_id))
        .filter((r) => r.external_fault_id);
      await upsertFaults(supabase, rows);

      const remote = payload?.inspection ?? {};
      await supabase
        .from('inspections')
        .update({
          status: 'completed',
          completed_at: inspection.completed_at ?? new Date().toISOString(),
          synced_at: new Date().toISOString(),
          ...(remote?.overall_grade != null ? { overall_grade: Number(remote.overall_grade) } : {}),
          ...(remote?.inspector_name ? { inspector_name: String(remote.inspector_name) } : {}),
        })
        .eq('id', inspection.id);

      await recomputeHasIssues(supabase, inspection.id);
      await syncBikeStatusFromFaults(supabase, inspection.bike_id, true);
      return json({ received: true });
    }

    const fault = payload?.fault ?? null;
    if (!fault) return json({ received: true });

    const faultId = String(fault?.id ?? fault?.fault_id ?? '');
    if (!faultId) return json({ received: true });

    if (event === 'fault.deleted') {
      await supabase.from('inspection_faults').delete().eq('external_fault_id', faultId);
    } else if (event === 'fault.created' || event === 'fault.updated' || event === 'fault.repaired') {
      const row = normaliseFault(fault, inspection.id, inspection.bike_id, event, inspection.business_id);
      const { data: existingRow } = await supabase
        .from('inspection_faults')
        .select('id')
        .eq('external_fault_id', row.external_fault_id)
        .maybeSingle();
      await upsertFaults(supabase, [row]);
      if (!existingRow) await notifyFaultsAwaitingApproval(supabase, inspection.bike_id, [row]);
    } else {
      return json({ received: true });
    }

    await recomputeHasIssues(supabase, inspection.id);

    // Defensive: confirm no open faults remain locally before releasing the bike.
    const { data: faultsNow } = await supabase
      .from('inspection_faults')
      .select('status')
      .eq('bike_id', inspection.bike_id);
    const hasOpen = (faultsNow || []).some((f: any) => isOpenFault(f.status));
    await syncBikeStatusFromFaults(
      supabase,
      inspection.bike_id,
      inspection.status === 'completed' || !hasOpen,
    );

    return json({ received: true });
  } catch (e) {
    console.error('inspectabike-webhook failed:', (e as Error).message);
    return json({ error: 'Processing failed' }, 500);
  }
});
