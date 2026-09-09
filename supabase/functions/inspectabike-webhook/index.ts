// Receives fault events from InspectABike. Signature-verified, no JWT.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { serviceClient, normaliseFault, syncBikeStatusFromFaults } from '../_shared/inspectabike.ts';

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
  const fault = payload?.fault ?? null;

  const supabase = serviceClient();

  try {
    if (!externalInspectionId || !fault) return json({ received: true });

    const { data: inspection } = await supabase
      .from('inspections')
      .select('id, bike_id, status')
      .or(`external_inspection_id.eq.${externalInspectionId},external_reference.eq.${externalInspectionId}`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!inspection) {
      console.error('inspectabike-webhook: no local inspection for', externalInspectionId);
      return json({ received: true });
    }

    const faultId = String(fault?.id ?? fault?.fault_id ?? '');
    if (!faultId) return json({ received: true });

    if (event === 'fault.deleted') {
      await supabase.from('inspection_faults').delete().eq('external_fault_id', faultId);
    } else {
      const row = normaliseFault(fault, inspection.id, inspection.bike_id);
      const { error } = await supabase
        .from('inspection_faults')
        .upsert(row, { onConflict: 'external_fault_id' });
      if (error) throw new Error(error.message);
    }

    await supabase
      .from('inspections')
      .update({ synced_at: new Date().toISOString(), has_issues: true })
      .eq('id', inspection.id);

    await syncBikeStatusFromFaults(supabase, inspection.bike_id, inspection.status === 'completed');

    return json({ received: true });
  } catch (e) {
    console.error('inspectabike-webhook failed:', (e as Error).message);
    return json({ error: 'Processing failed' }, 500);
  }
});
