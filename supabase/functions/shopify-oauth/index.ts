// Shopify OAuth + configuration endpoint.
// GET  with ?code=&shop=  → OAuth callback from Shopify (browser redirect, no JWT)
// POST { action }         → authenticated JSON API
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import {
  serviceClient,
  loadIntegration,
  loadSettings,
  saveSettings,
  normaliseShopDomain,
  redirectUri,
  webhookUrl,
  shopifyRest,
  requireUser,
  requireRole,
  hmacHex,
  timingSafeEqual,
  SHOPIFY_SCOPES,
  type ShopifySettings,
} from '../_shared/shopify.ts';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const FALLBACK_APP_ORIGIN = 'https://id-preview--ccc5c487-99e6-4e3f-8a56-0755e4113f30.lovable.app';

function safeOrigin(state: string | null): string {
  if (!state) return FALLBACK_APP_ORIGIN;
  try {
    const decoded = decodeURIComponent(state);
    const origin = decoded.split('|')[0];
    const u = new URL(origin);
    if (u.protocol === 'http:' || u.protocol === 'https:') return u.origin;
  } catch { /* ignore */ }
  return FALLBACK_APP_ORIGIN;
}

const backToApp = (origin: string, params: Record<string, string>) => {
  const qs = new URLSearchParams({ tab: 'integrations', ...params });
  return new Response(null, { status: 302, headers: { Location: `${origin}/settings?${qs}` } });
};

const WEBHOOK_TOPICS = ['orders/paid', 'orders/cancelled', 'refunds/create'];
// Compliance topics (customers/data_request, customers/redact, shop/redact) and
// app/uninstalled are declared in the Partner Dashboard app configuration, not here.

async function registerWebhooks(settings: { shop_domain: string; access_token: string }) {
  const address = webhookUrl();
  let existing: any = null;
  try {
    existing = await shopifyRest(settings, '/webhooks.json?limit=250');
  } catch (e) {
    console.error('Could not list Shopify webhooks:', (e as Error).message);
  }
  const current: any[] = existing?.webhooks ?? [];
  const wanted: Array<{ topic: string; target: string }> = WEBHOOK_TOPICS.map((topic) => ({
    topic,
    target: address,
  }));

  for (const { topic, target } of wanted) {
    if (current.some((w) => w.topic === topic && w.address === target)) continue;
    try {
      await shopifyRest(settings, '/webhooks.json', {
        method: 'POST',
        body: JSON.stringify({ webhook: { topic, address: target, format: 'json' } }),
      });
    } catch (e) {
      console.error(`Could not register Shopify webhook ${topic}:`, (e as Error).message);
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = serviceClient();
  const url = new URL(req.url);

  // ---- OAuth callback from Shopify ----
  if (req.method === 'GET' && url.searchParams.get('code') && url.searchParams.get('shop')) {
    const state = url.searchParams.get('state');
    try {
      const clientId = Deno.env.get('SHOPIFY_CLIENT_ID');
      const clientSecret = Deno.env.get('SHOPIFY_CLIENT_SECRET');
      if (!clientId || !clientSecret) throw new Error('SHOPIFY_CLIENT_ID / SHOPIFY_CLIENT_SECRET are not configured');

      // Verify Shopify's query signature.
      const params = new URLSearchParams(url.search);
      const providedHmac = params.get('hmac') || '';
      params.delete('hmac');
      params.delete('signature');
      const sorted = [...params.entries()].sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([k, v]) => `${k}=${v}`).join('&');
      const expected = await hmacHex(clientSecret, sorted);
      if (!timingSafeEqual(expected, providedHmac)) throw new Error('Signature check failed');

      const shop = normaliseShopDomain(url.searchParams.get('shop')!);
      const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code: url.searchParams.get('code'),
        }),
      });
      const tokenText = await tokenRes.text();
      if (!tokenRes.ok) throw new Error(`Token exchange failed [${tokenRes.status}]: ${tokenText}`);
      const tokens = JSON.parse(tokenText);

      const connection = { shop_domain: shop, access_token: tokens.access_token as string };

      let shopName = shop;
      let locationId: string | undefined;
      try {
        const info = await shopifyRest(connection, '/shop.json');
        shopName = info?.shop?.name || shop;
      } catch { /* non-fatal */ }
      try {
        const locations = await shopifyRest(connection, '/locations.json');
        const active = (locations?.locations ?? []).find((l: any) => l.active) ?? locations?.locations?.[0];
        if (active) locationId = String(active.id);
      } catch { /* non-fatal */ }

      await saveSettings(supabase, {
        shop_domain: shop,
        access_token: tokens.access_token,
        scope: tokens.scope,
        shop_name: shopName,
        location_id: locationId,
        connected_at: new Date().toISOString(),
      });

      await registerWebhooks(connection);

      return backToApp(safeOrigin(state), { shopify: 'connected' });
    } catch (e) {
      console.error('Shopify callback error', e);
      return backToApp(safeOrigin(state), {
        shopify: 'error',
        message: String((e as Error).message).slice(0, 300),
      });
    }
  }

  // ---- Authenticated JSON API ----
  let userId: string;
  try {
    const user = await requireUser(req, supabase);
    await requireRole(supabase, user.id, ['admin', 'owner']);
    userId = user.id;
  } catch (e) {
    return json({ error: (e as Error).message }, 401);
  }

  try {
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const action = body.action || url.searchParams.get('action') || 'status';

    if (action === 'status') {
      const row = await loadIntegration(supabase);
      const settings = ((row?.settings ?? {}) as ShopifySettings) || {};
      return json({
        connected: Boolean(row?.is_active && settings.access_token && settings.shop_domain),
        shop_domain: settings.shop_domain ?? null,
        shop_name: settings.shop_name ?? null,
        connected_at: settings.connected_at ?? null,
        auto_list: settings.auto_list ?? true,
        product_type: settings.product_type ?? 'Bicycle',
        vendor: settings.vendor ?? '',
        location_id: settings.location_id ?? null,
        callback_url: redirectUri(),
      });
    }

    if (action === 'auth_url') {
      const clientId = Deno.env.get('SHOPIFY_CLIENT_ID');
      if (!clientId) throw new Error('SHOPIFY_CLIENT_ID is not configured');
      const shop = normaliseShopDomain(body.shop_domain ?? '');
      const origin = typeof body.origin === 'string' && /^https?:\/\//.test(body.origin)
        ? body.origin.replace(/\/+$/, '')
        : FALLBACK_APP_ORIGIN;
      const state = encodeURIComponent(`${origin}|${crypto.randomUUID()}`);
      const authUrl = `https://${shop}/admin/oauth/authorize?` + new URLSearchParams({
        client_id: clientId,
        scope: SHOPIFY_SCOPES,
        redirect_uri: redirectUri(),
        state,
      });
      return json({ url: authUrl });
    }

    if (action === 'save_settings') {
      const settings = await saveSettings(supabase, {
        auto_list: Boolean(body.auto_list),
        product_type: typeof body.product_type === 'string' ? body.product_type.slice(0, 80) : undefined,
        vendor: typeof body.vendor === 'string' ? body.vendor.slice(0, 80) : undefined,
        location_id: typeof body.location_id === 'string' ? body.location_id : undefined,
      });
      return json({ ok: true, auto_list: settings.auto_list });
    }

    if (action === 'locations') {
      const settings = await loadSettings(supabase);
      if (!settings.access_token || !settings.shop_domain) return json({ locations: [] });
      const data = await shopifyRest(settings as any, '/locations.json');
      return json({
        locations: (data?.locations ?? []).map((l: any) => ({ id: String(l.id), name: l.name })),
      });
    }

    if (action === 'disconnect') {
      const row = await loadIntegration(supabase);
      if (row) {
        const { error } = await supabase
          .from('integrations')
          .update({ settings: {}, is_active: false, updated_at: new Date().toISOString() })
          .eq('id', (row as { id: string }).id);
        if (error) throw new Error(error.message);
      }
      console.log(`Shopify disconnected by ${userId}`);
      return json({ ok: true });
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (e) {
    console.error('shopify-oauth error:', (e as Error).message);
    return json({ error: (e as Error).message }, 400);
  }
});
