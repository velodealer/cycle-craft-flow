// Squarespace OAuth + configuration.
// GET ?code=&state=  → OAuth callback (browser redirect, no JWT)
// POST { action }    → authenticated JSON API (admin/owner)
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import {
  serviceClient, SQS_LOGIN, SQS_SCOPES, redirectUri, webhookUrl, tokenRequest, revokeToken,
  loadIntegration, saveSettings, accessToken, sqsFetch, requireUser, requireRole, businessIdForUser,
} from '../_shared/squarespace.ts';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const FALLBACK_ORIGIN = Deno.env.get('SHOPIFY_APP_ORIGIN') || 'https://velodealer.com';

const back = (origin: string, params: Record<string, string>) =>
  new Response(null, {
    status: 302,
    headers: { Location: `${origin}/settings?${new URLSearchParams({ tab: 'integrations', ...params })}` },
  });

function safeOrigin(o: unknown): string {
  try {
    const u = new URL(String(o));
    if (u.protocol === 'https:' || u.protocol === 'http:') return u.origin;
  } catch { /* ignore */ }
  return FALLBACK_ORIGIN;
}

async function ensureWebhook(supabase: ReturnType<typeof serviceClient>, businessId: string) {
  const { token, settings } = await accessToken(supabase, businessId);
  if (settings.webhook_id && settings.webhook_secret) return;
  const sub = await sqsFetch(token, '/1.0/webhook_subscriptions', {
    method: 'POST',
    body: JSON.stringify({ endpointUrl: webhookUrl(), topics: ['order.create'] }),
  });
  await saveSettings(supabase, businessId, { webhook_id: sub.id, webhook_secret: sub.secret });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const supabase = serviceClient();
  const url = new URL(req.url);

  // ---- OAuth callback ----
  if (req.method === 'GET' && url.searchParams.get('state')) {
    const state = url.searchParams.get('state')!;
    const { data: st } = await supabase.from('squarespace_oauth_states')
      .delete().eq('state', state).select('business_id, return_origin, created_at').maybeSingle();
    const origin = safeOrigin(st?.return_origin);
    try {
      if (!st || Date.now() - new Date(st.created_at).getTime() > 10 * 60 * 1000) {
        throw new Error('Sign-in session expired — please press Connect again');
      }
      if (url.searchParams.get('error')) throw new Error(url.searchParams.get('error_description') || 'Squarespace access was not granted');
      const code = url.searchParams.get('code');
      if (!code) throw new Error('No authorisation code returned');
      const t = await tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: redirectUri() });
      await saveSettings(supabase, st.business_id, {
        access_token: t.access_token,
        refresh_token: t.refresh_token,
        access_token_expires_at: t.access_token_expires_at,
        connected_at: new Date().toISOString(),
        webhook_id: undefined,
        webhook_secret: undefined,
      });
      try {
        const site = await sqsFetch(t.access_token, '/1.0/authorization/website');
        await saveSettings(supabase, st.business_id, {
          website_id: site.id, website_title: site.title, website_url: site.url, currency: site.currency || undefined,
        });
      } catch (e) { console.warn('site info failed', (e as Error).message); }
      try {
        const pages = await sqsFetch(t.access_token, '/1.0/commerce/store_pages');
        const list = pages.storePages ?? [];
        if (list.length === 1) await saveSettings(supabase, st.business_id, { store_page_id: list[0].id, store_page_title: list[0].title });
      } catch (e) { console.warn('store pages failed', (e as Error).message); }
      try { await ensureWebhook(supabase, st.business_id); } catch (e) { console.warn('webhook failed', (e as Error).message); }
      return back(origin, { squarespace: 'connected' });
    } catch (e) {
      console.error('Squarespace callback error', e);
      return back(origin, { squarespace: 'error', message: String((e as Error).message).slice(0, 300) });
    }
  }

  // ---- Authenticated API ----
  let userId: string, businessId: string, role: string;
  try {
    const user = await requireUser(req, supabase);
    userId = user.id;
    role = await requireRole(supabase, user.id, ['admin', 'owner', 'mechanic', 'detailer', 'accountant', 'social_manager', 'customer_service']);
    businessId = await businessIdForUser(supabase, user.id);
  } catch (e) {
    return json({ error: (e as Error).message }, 401);
  }
  const canManage = role === 'admin' || role === 'owner';

  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || 'status');

    if (action === 'status') {
      const row = await loadIntegration(supabase, businessId);
      const s = row?.settings ?? {};
      return json({
        connected: Boolean(row?.is_active && s.access_token),
        website_title: s.website_title ?? null,
        website_url: s.website_url ?? null,
        store_page_id: s.store_page_id ?? null,
        store_page_title: s.store_page_title ?? null,
        live_sales: Boolean(s.webhook_id),
        connected_at: s.connected_at ?? null,
        callback_url: redirectUri(),
      });
    }

    if (!canManage) return json({ error: 'Only admins and owners can change the Squarespace connection' }, 403);

    if (action === 'auth_url') {
      const clientId = Deno.env.get('SQUARESPACE_CLIENT_ID');
      if (!clientId) throw new Error('Squarespace app credentials are not configured');
      const state = crypto.randomUUID();
      const { error } = await supabase.from('squarespace_oauth_states').insert({
        state, business_id: businessId, user_id: userId, return_origin: safeOrigin(body.origin),
      });
      if (error) throw new Error(error.message);
      const qs = new URLSearchParams({
        client_id: clientId, redirect_uri: redirectUri(), scope: SQS_SCOPES, state, access_type: 'offline',
      });
      return json({ url: `${SQS_LOGIN}/authorize?${qs}` });
    }

    if (action === 'store_pages') {
      const { token } = await accessToken(supabase, businessId);
      const pages = await sqsFetch(token, '/1.0/commerce/store_pages');
      return json({ pages: (pages.storePages ?? []).map((p: any) => ({ id: p.id, title: p.title, enabled: p.isEnabled })) });
    }

    if (action === 'set_store_page') {
      const id = String(body.store_page_id || '').slice(0, 100);
      if (!id) return json({ error: 'store_page_id is required' }, 400);
      await saveSettings(supabase, businessId, { store_page_id: id, store_page_title: String(body.store_page_title || '').slice(0, 200) });
      return json({ ok: true });
    }

    if (action === 'setup_webhook') {
      await ensureWebhook(supabase, businessId);
      return json({ ok: true });
    }

    if (action === 'disconnect') {
      const row = await loadIntegration(supabase, businessId);
      const s = row?.settings ?? {};
      if (s.webhook_id && s.access_token) {
        try {
          const { token } = await accessToken(supabase, businessId);
          await sqsFetch(token, `/1.0/webhook_subscriptions/${s.webhook_id}`, { method: 'DELETE' });
        } catch { /* ignore */ }
      }
      if (s.refresh_token) await revokeToken(s.refresh_token);
      if (row) {
        await supabase.from('integrations').update({ settings: {}, is_active: false, updated_at: new Date().toISOString() }).eq('id', row.id);
      }
      return json({ ok: true });
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (e) {
    console.error('squarespace-oauth error:', (e as Error).message);
    return json({ error: (e as Error).message }, 400);
  }
});
