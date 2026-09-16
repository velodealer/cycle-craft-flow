// eBay notification endpoint.
// GET  ?challenge_code=... → hash response required by eBay before it accepts the endpoint
// POST                     → marketplace account deletion and other notifications
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { serviceClient } from '../_shared/ebay.ts';

const endpointUrl = () => `${Deno.env.get('SUPABASE_URL')}/functions/v1/ebay-notifications`;

async function sha256Hex(input: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const url = new URL(req.url);

  // eBay endpoint validation handshake.
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

  try {
    const body = await req.json().catch(() => ({}));
    const topic = body?.metadata?.topic ?? body?.topic ?? 'unknown';
    console.log('eBay notification received:', topic, JSON.stringify(body).slice(0, 800));

    if (topic === 'MARKETPLACE_ACCOUNT_DELETION') {
      const supabase = serviceClient();
      const username = body?.notification?.data?.username;
      const email = body?.notification?.data?.userId;
      console.log(`eBay account deletion request for ${username ?? email ?? 'unknown user'}`);
      // VeloDealer keeps no eBay buyer profiles; nothing further to erase.
      void supabase;
    }
  } catch (e) {
    console.error('ebay-notifications error:', (e as Error).message);
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
