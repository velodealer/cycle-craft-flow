// InspectABike OAuth (authorization code + PKCE) — one connected account per dealer.
// GET  ?code=&state=  → approval callback (browser redirect, no JWT)
// POST { action }     → authenticated JSON API (status / auth_url / disconnect)
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import {
  serviceClient,
  requireUser,
  loadConnection,
  exchangeCode,
  redirectUri,
  webhookUrl,
  clientCredentials,
  getAccessToken,
  INSPECTABIKE_BASE_URL,
  IAB_AUTHORIZE_URL,
} from '../_shared/inspectabike.ts';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const FALLBACK_APP_ORIGIN = 'https://id-preview--ccc5c487-99e6-4e3f-8a56-0755e4113f30.lovable.app';

const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function pkce() {
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return { verifier, challenge: b64url(new Uint8Array(digest)) };
}

function safeOrigin(value: unknown): string {
  if (typeof value !== 'string') return FALLBACK_APP_ORIGIN;
  try {
    const u = new URL(value);
    if (u.protocol === 'http:' || u.protocol === 'https:') return u.origin;
  } catch { /* ignore */ }
  return FALLBACK_APP_ORIGIN;
}

const backToApp = (origin: string, params: Record<string, string>) => {
  const qs = new URLSearchParams({ tab: 'integrations', ...params });
  return new Response(null, { status: 302, headers: { Location: `${origin}/settings?${qs}` } });
};

/** Ask InspectABike for this dealer's signing key and store it. Never returns the value. */
async function fetchWebhookSecret(supabase: ReturnType<typeof serviceClient>, businessId: string) {
  const token = await getAccessToken(supabase, businessId);
  const res = await fetch(`${INSPECTABIKE_BASE_URL}/partner-webhook-config`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ webhook_url: webhookUrl() }),
  });
  const text = await res.text();
  let body: any = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = null; }
  if (!res.ok) {
    throw new Error(`InspectABike refused the signing key request [${res.status}]: ${(body?.error || body?.message || text).toString().slice(0, 200)}`);
  }
  const secret = body?.webhook_secret ?? body?.data?.webhook_secret;
  if (!secret) {
    console.log('partner-webhook-config returned no webhook_secret; keys:', Object.keys(body || {}));
    throw new Error('InspectABike did not return a signing key');
  }
  const { error } = await supabase
    .from('inspectabike_connections')
    .update({ webhook_secret: String(secret) })
    .eq('business_id', businessId);
  if (error) throw new Error(error.message);
  console.log('Stored InspectABike signing key for business', businessId);
}

async function profileFor(supabase: ReturnType<typeof serviceClient>, userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('role, business_id')
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !data) throw new Error('Profile not found');
  return data as { role: string; business_id: string };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = serviceClient();
  const url = new URL(req.url);

  // ---- Approval callback ----
  if (req.method === 'GET' && (url.searchParams.get('code') || url.searchParams.get('error'))) {
    let origin = FALLBACK_APP_ORIGIN;
    try {
      const state = url.searchParams.get('state') || '';
      if (!state) throw new Error('Missing state');

      await supabase
        .from('inspectabike_oauth_states')
        .delete()
        .lt('created_at', new Date(Date.now() - 10 * 60_000).toISOString());

      const { data: stateRow } = await supabase
        .from('inspectabike_oauth_states')
        .select('*')
        .eq('state', state)
        .maybeSingle();
      if (!stateRow) throw new Error('This connection link has expired — please try again');

      const row = stateRow as { business_id: string; code_verifier: string; origin?: string | null };
      origin = safeOrigin(row.origin);
      await supabase.from('inspectabike_oauth_states').delete().eq('state', state);

      const oauthError = url.searchParams.get('error');
      if (oauthError) {
        throw new Error(
          oauthError === 'access_denied'
            ? 'The connection was cancelled'
            : url.searchParams.get('error_description') || oauthError,
        );
      }

      const tokens = await exchangeCode(url.searchParams.get('code')!, row.code_verifier);

      const { error: upsertError } = await supabase
        .from('inspectabike_connections')
        .upsert(
          {
            business_id: row.business_id,
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            access_token_expires_at: new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString(),
            account_name: tokens.account_name ?? null,
            external_account_id: tokens.account_id ? String(tokens.account_id) : null,
            ...(tokens.webhook_secret ? { webhook_secret: tokens.webhook_secret } : {}),
            status: 'connected',
            last_error: null,
            connected_at: new Date().toISOString(),
          },
          { onConflict: 'business_id' },
        );
      if (upsertError) throw new Error(upsertError.message);

      if (!tokens.webhook_secret) {
        try { await fetchWebhookSecret(supabase, row.business_id); }
        catch (e) { console.error('Signing key fetch after connect failed:', (e as Error).message); }
      }

      return backToApp(origin, { inspectabike: 'connected' });
    } catch (e) {
      console.error('InspectABike callback error', e);
      return backToApp(origin, {
        inspectabike: 'error',
        message: String((e as Error).message).slice(0, 300),
      });
    }
  }

  // ---- Authenticated JSON API ----
  let profile: { role: string; business_id: string };
  let userId: string;
  try {
    const user = await requireUser(req, supabase);
    profile = await profileFor(supabase, user.id);
    userId = user.id;
  } catch (e) {
    return json({ error: (e as Error).message }, 401);
  }

  try {
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const action = body.action || url.searchParams.get('action') || 'status';
    const isAdmin = profile.role === 'admin' || profile.role === 'owner';
    const configured = Boolean(
      Deno.env.get('INSPECTABIKE_CLIENT_ID') && Deno.env.get('INSPECTABIKE_CLIENT_SECRET'),
    );

    if (action === 'status') {
      const row = await loadConnection(supabase, profile.business_id);
      return json({
        configured,
        connected: Boolean(row?.refresh_token && row.status === 'connected'),
        needs_reconnect: row?.status === 'needs_reconnect',
        account_name: row?.account_name ?? null,
        connected_at: row?.connected_at ?? null,
        last_error: row?.last_error ?? null,
        callback_url: redirectUri(),
        webhook_url: webhookUrl(),
        has_webhook_secret: Boolean(row?.webhook_secret),
        has_platform_webhook_secret: Boolean(Deno.env.get('INSPECTABIKE_WEBHOOK_SECRET')),
      });
    }

    if (!isAdmin) return json({ error: 'Only admins and owners can change this' }, 403);

    if (action === 'auth_url') {
      const { clientId } = clientCredentials();
      const { verifier, challenge } = await pkce();
      const state = b64url(crypto.getRandomValues(new Uint8Array(24)));
      const origin = safeOrigin(body.origin);

      const { error } = await supabase.from('inspectabike_oauth_states').insert({
        state,
        business_id: profile.business_id,
        user_id: userId,
        code_verifier: verifier,
        origin,
      });
      if (error) throw new Error(error.message);

      const authUrl = new URL(IAB_AUTHORIZE_URL);
      authUrl.search = new URLSearchParams({
        response_type: 'code',
        client_id: clientId,
        redirect_uri: redirectUri(),
        state,
        scope: 'inspections faults',
        webhook_url: webhookUrl(),
        code_challenge: challenge,
        code_challenge_method: 'S256',
      }).toString();

      return json({ url: authUrl.toString() });
    }

    if (action === 'fetch_webhook_secret') {
      await fetchWebhookSecret(supabase, profile.business_id);
      return json({ ok: true, has_webhook_secret: true });
    }

    if (action === 'disconnect') {
      const { error } = await supabase
        .from('inspectabike_connections')
        .delete()
        .eq('business_id', profile.business_id);
      if (error) throw new Error(error.message);
      return json({ ok: true });
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (e) {
    console.error('inspectabike-oauth error', (e as Error).message);
    return json({ error: (e as Error).message }, 400);
  }
});
