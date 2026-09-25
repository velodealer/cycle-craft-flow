// eBay notification endpoint.
// GET  ?challenge_code=... → hash response required by eBay before it accepts the endpoint
// POST                     → marketplace account deletion notifications (signature verified)
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createVerify } from 'node:crypto';
import { apiBase, type EbayEnvironment } from '../_shared/ebay.ts';

// Must match, character for character, the endpoint typed into the eBay developer portal.
const endpointUrl = () =>
  Deno.env.get('EBAY_NOTIFICATION_ENDPOINT') || 'https://api.velodealer.com/functions/v1/ebay-notifications';

async function sha256Hex(input: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

const keyCache = new Map<string, string>();

async function appToken(env: EbayEnvironment) {
  const id = (env === 'production' ? Deno.env.get('EBAY_PROD_CLIENT_ID') : undefined) ?? Deno.env.get('EBAY_CLIENT_ID');
  const secret = (env === 'production' ? Deno.env.get('EBAY_PROD_CLIENT_SECRET') : undefined) ?? Deno.env.get('EBAY_CLIENT_SECRET');
  if (!id || !secret) throw new Error('eBay app credentials missing');
  const res = await fetch(`${apiBase(env)}/identity/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${btoa(`${id}:${secret}`)}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope',
  });
  if (!res.ok) throw new Error(`token ${res.status}: ${await res.text()}`);
  return (await res.json()).access_token as string;
}

async function publicKey(kid: string): Promise<string> {
  const cached = keyCache.get(kid);
  if (cached) return cached;
  const errs: string[] = [];
  for (const env of ['production', 'sandbox'] as EbayEnvironment[]) {
    try {
      const token = await appToken(env);
      const res = await fetch(`${apiBase(env)}/commerce/notification/v1/public_key/${encodeURIComponent(kid)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { errs.push(`${env} ${res.status}: ${await res.text()}`); continue; }
      let pem = (await res.json()).key as string;
      if (!pem.includes('\n')) {
        pem = pem.replace('-----BEGIN PUBLIC KEY-----', '-----BEGIN PUBLIC KEY-----\n')
          .replace('-----END PUBLIC KEY-----', '\n-----END PUBLIC KEY-----');
      }
      keyCache.set(kid, pem);
      return pem;
    } catch (e) { errs.push(`${env}: ${(e as Error).message}`); }
  }
  throw new Error(`public key lookup failed: ${errs.join(' | ')}`);
}

type SigResult = 'valid' | 'invalid' | 'unverifiable';

async function verifySignature(header: string | null, rawBody: string): Promise<SigResult> {
  if (!header) return 'invalid';
  let decoded: { kid?: string; signature?: string };
  try { decoded = JSON.parse(atob(header)); } catch { return 'invalid'; }
  if (!decoded.kid || !decoded.signature) return 'invalid';
  let pem: string;
  try { pem = await publicKey(decoded.kid); } catch (e) {
    console.error('eBay signature unverifiable (our side):', (e as Error).message);
    return 'unverifiable';
  }
  try {
    const v = createVerify('sha1');
    v.update(rawBody);
    v.end();
    return v.verify(pem, decoded.signature, 'base64') ? 'valid' : 'invalid';
  } catch (e) {
    console.error('eBay signature check error:', (e as Error).message);
    return 'invalid';
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const url = new URL(req.url);
  const challenge = url.searchParams.get('challenge_code');
  if (req.method === 'GET' && challenge) {
    const token = Deno.env.get('EBAY_VERIFICATION_TOKEN');
    if (!token) return new Response('EBAY_VERIFICATION_TOKEN is not configured', { status: 500 });
    const challengeResponse = await sha256Hex(`${challenge}${token}${endpointUrl()}`);
    return new Response(JSON.stringify({ challengeResponse }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (req.method !== 'POST') return new Response('ok', { headers: corsHeaders });

  const raw = await req.text();
  const sig = await verifySignature(req.headers.get('x-ebay-signature'), raw);
  if (sig === 'invalid') {
    return new Response('invalid signature', { status: 412, headers: corsHeaders });
  }
  if (sig === 'unverifiable') {
    console.warn('Accepting eBay notification without verification (logged only, not actioned):', raw.slice(0, 500));
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const body = JSON.parse(raw || '{}');
    const topic = body?.metadata?.topic ?? 'unknown';
    const data = body?.notification?.data ?? {};
    console.log(
      `eBay notification ${topic} at ${new Date().toISOString()}: username=${data.username ?? '-'} userId=${data.userId ?? '-'}`,
    );
    // VeloDealer stores no eBay buyer profiles; nothing further to erase.
  } catch (e) {
    console.error('ebay-notifications parse error:', (e as Error).message);
  }

  return new Response(null, { status: 204, headers: corsHeaders });
});
