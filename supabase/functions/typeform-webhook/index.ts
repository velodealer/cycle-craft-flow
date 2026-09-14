// Receives form responses from Typeform. Signature-verified, no JWT.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { serviceClient, getTypeformAuth } from '../_shared/typeform.ts';
import { extractFromFormResponse } from '../_shared/typeform-extract.ts';
import { rehostTypeformFiles } from '../_shared/typeform-files.ts';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const toBase64 = (buf: ArrayBuffer) => {
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
};

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
  return timingSafeEqual(toBase64(sig), signature.trim().replace(/^sha256=/i, ''));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: { ...corsHeaders, 'Access-Control-Allow-Headers': 'content-type, typeform-signature' },
    });
  }

  console.log(`typeform-webhook: received ${req.method} request`);

  const secret = Deno.env.get('TYPEFORM_WEBHOOK_SECRET');
  if (!secret) {
    console.error('typeform-webhook: TYPEFORM_WEBHOOK_SECRET is not configured');
    return json({ error: 'Webhook secret not configured' }, 500);
  }

  const signature = req.headers.get('typeform-signature') || '';
  const rawBody = await req.text();

  if (!signature || !(await verify(rawBody, signature, secret))) {
    console.error(
      `typeform-webhook: rejected — ${signature ? 'signature mismatch' : 'no typeform-signature header'} (body ${rawBody.length} bytes)`,
    );
    return json({ error: 'Invalid signature' }, 401);
  }

  try {
    const payload = JSON.parse(rawBody);
    const formResponse = payload?.form_response;
    const formId: string | undefined = formResponse?.form_id;
    const responseId: string | undefined = formResponse?.response_id;
    const eventType: string | undefined = payload?.event_type;

    console.log(`typeform-webhook: verified event=${eventType} form=${formId} response=${responseId}`);

    if (!formId || !responseId) return json({ error: 'Missing form_id or response_id' }, 400);
    if (eventType && eventType !== 'form_response') return json({ ok: true, skipped: eventType });

    const supabase = serviceClient();

    // Idempotency: response_id is unique.
    const { data: existing } = await supabase
      .from('typeform_submissions')
      .select('id')
      .eq('response_id', responseId)
      .maybeSingle();
    if (existing) {
      console.log(`typeform-webhook: duplicate response ${responseId} ignored`);
      return json({ ok: true, duplicate: true });
    }

    // Load the stored field map for this form.
    const { data: formRow } = await supabase
      .from('typeform_forms')
      .select('id, enabled, field_map')
      .eq('form_id', formId)
      .maybeSingle();

    if (!formRow) {
      console.warn(`typeform-webhook: no stored form row for ${formId} — saving with no field mapping`);
    } else if (!(formRow as any).enabled) {
      console.warn(`typeform-webhook: form ${formId} is switched off locally — saving anyway`);
    }

    const fieldMap = ((formRow as any)?.field_map ?? {}) as Record<string, string>;
    const extracted = extractFromFormResponse(formResponse, fieldMap);
    const submittedAt = formResponse?.submitted_at ?? new Date().toISOString();

    const { error } = await supabase.from('typeform_submissions').insert({
      form_id: formId,
      response_id: responseId,
      submitted_at: submittedAt,
      raw_payload: payload,
      ...extracted,
      status: 'new',
    });
    if (error) throw new Error(error.message);

    console.log(`typeform-webhook: saved submission for response ${responseId}`);
    return json({ ok: true });
  } catch (e) {
    console.error('typeform-webhook error', e);
    return json({ error: (e as Error).message }, 500);
  }
});
