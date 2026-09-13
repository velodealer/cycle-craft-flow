// Receives form responses from Typeform. Signature-verified, no JWT.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { serviceClient } from '../_shared/typeform.ts';

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

interface Answer {
  type: string;
  field?: { id?: string; ref?: string };
  text?: string;
  email?: string;
  phone_number?: string;
  number?: number;
  choice?: { label?: string; other?: string; choices?: string[] };
  boolean?: boolean;
  date?: string;
  file_url?: string;
  payment?: { amount?: number };
}

/** Picks the best string value from a Typeform answer. */
function answerText(a: Answer | undefined): string {
  if (!a) return '';
  if (a.text) return a.text;
  if (a.email) return a.email;
  if (a.phone_number) return a.phone_number;
  if (a.choice) {
    return a.choice.other || a.choice.label || (a.choice.choices ?? []).join(', ') || '';
  }
  if (typeof a.number === 'number') return String(a.number);
  if (a.boolean !== undefined) return a.boolean ? 'Yes' : 'No';
  if (a.date) return a.date;
  if (a.file_url) return a.file_url;
  return '';
}

function answerIsPhoto(a: Answer | undefined): boolean {
  return Boolean(a?.file_url);
}

interface Extracted {
  submission_type: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  postcode: string | null;
  bike_make: string | null;
  bike_model: string | null;
  bike_year: number | null;
  frame_number: string | null;
  asking_price: number | null;
  photo_urls: string[];
}

function extract(raw: any, fieldMap: Record<string, string>): Extracted {
  const answers: Answer[] = raw?.form_response?.answers ?? [];
  const byFieldId = new Map<string, Answer>();
  for (const a of answers) {
    const id = a.field?.ref || a.field?.id;
    if (id) byFieldId.set(id, a);
  }
  // Hidden fields can also carry values (e.g. source tags).
  const hidden: Record<string, string> = raw?.form_response?.hidden ?? {};

  const get = (key: string): Answer | undefined => {
    const ref = fieldMap[key];
    if (!ref) return undefined;
    return byFieldId.get(ref);
  };
  const str = (key: string): string => answerText(get(key)) || (hidden[key] ?? '');

  const photoUrls: string[] = [];
  for (const a of answers) {
    if (answerIsPhoto(a) && a.file_url) photoUrls.push(a.file_url);
  }

  const yearRaw = str('bike_year');
  const year = yearRaw ? parseInt(yearRaw.replace(/[^0-9]/g, ''), 10) : NaN;
  const priceRaw = str('asking_price');
  const price = priceRaw ? parseFloat(priceRaw.replace(/[^0-9.]/g, '')) : NaN;

  const typeRaw = (str('submission_type') || '').toLowerCase();
  let submissionType: string | null = null;
  if (typeRaw.includes('part')) submissionType = 'part_exchange';
  else if (typeRaw.includes('sell') || typeRaw.includes('sale')) submissionType = 'sale';

  return {
    submission_type: submissionType,
    customer_name: str('customer_name') || null,
    customer_email: str('customer_email') || null,
    customer_phone: str('customer_phone') || null,
    postcode: str('postcode') || null,
    bike_make: str('bike_make') || null,
    bike_model: str('bike_model') || null,
    bike_year: Number.isFinite(year) && year > 1900 && year < 2200 ? year : null,
    frame_number: str('frame_number') || null,
    asking_price: Number.isFinite(price) && price > 0 ? price : null,
    photo_urls: photoUrls,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: { ...corsHeaders, 'Access-Control-Allow-Headers': 'content-type, typeform-signature' },
    });
  }

  const secret = Deno.env.get('TYPEFORM_WEBHOOK_SECRET');
  if (!secret) return json({ error: 'Webhook secret not configured' }, 500);

  const signature = req.headers.get('typeform-signature') || '';
  const rawBody = await req.text();

  if (!signature || !(await verify(rawBody, signature, secret))) {
    return json({ error: 'Invalid signature' }, 401);
  }

  try {
    const payload = JSON.parse(rawBody);
    const formId: string | undefined = payload?.form_response?.form_id;
    const responseId: string | undefined = payload?.form_response?.response_id;
    const eventType: string | undefined = payload?.event_type;

    if (!formId || !responseId) return json({ error: 'Missing form_id or response_id' }, 400);
    if (eventType && eventType !== 'form_response') return json({ ok: true, skipped: eventType });

    const supabase = serviceClient();

    // Idempotency: response_id is unique.
    const { data: existing } = await supabase
      .from('typeform_submissions')
      .select('id')
      .eq('response_id', responseId)
      .maybeSingle();
    if (existing) return json({ ok: true, duplicate: true });

    // Load the stored field map for this form.
    const { data: formRow } = await supabase
      .from('typeform_forms')
      .select('id, enabled, field_map')
      .eq('form_id', formId)
      .maybeSingle();

    const fieldMap = ((formRow as any)?.field_map ?? {}) as Record<string, string>;
    const extracted = extract(payload, fieldMap);
    const submittedAt = payload?.form_response?.submitted_at ?? new Date().toISOString();

    const { error } = await supabase.from('typeform_submissions').insert({
      form_id: formId,
      response_id: responseId,
      submitted_at: submittedAt,
      raw_payload: payload,
      ...extracted,
      status: 'new',
    });
    if (error) throw new Error(error.message);

    return json({ ok: true });
  } catch (e) {
    console.error('typeform-webhook error', e);
    // Return 200 to prevent Typeform retries on permanent errors; log for diagnosis.
    return json({ error: (e as Error).message }, 500);
  }
});
