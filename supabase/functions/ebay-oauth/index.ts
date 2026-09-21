// eBay OAuth + configuration endpoint.
// GET  with ?code=     → OAuth callback from eBay (browser redirect, no JWT)
// POST { action }      → authenticated JSON API
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import {
  serviceClient,
  loadIntegration,
  saveSettings,
  businessIdForUser,
  requireConnection,
  requireUser,
  requireRole,
  exchangeCode,
  ebayFetch,
  authBase,
  redirectUri,
  EBAY_SCOPES,
  type EbayEnvironment,
  type EbaySettings,
} from '../_shared/ebay.ts';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const FALLBACK_APP_ORIGIN = 'https://id-preview--ccc5c487-99e6-4e3f-8a56-0755e4113f30.lovable.app';

function safeOrigin(state: string | null): string {
  if (!state) return FALLBACK_APP_ORIGIN;
  try {
    const origin = decodeURIComponent(state).split('|')[0];
    const u = new URL(origin);
    if (u.protocol === 'http:' || u.protocol === 'https:') return u.origin;
  } catch { /* ignore */ }
  return FALLBACK_APP_ORIGIN;
}

const backToApp = (origin: string, params: Record<string, string>) => {
  const qs = new URLSearchParams({ tab: 'integrations', ...params });
  return new Response(null, { status: 302, headers: { Location: `${origin}/settings?${qs}` } });
};

function envFromState(state: string | null): EbayEnvironment {
  try {
    return decodeURIComponent(state ?? '').split('|')[2] === 'production' ? 'production' : 'sandbox';
  } catch {
    return 'sandbox';
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = serviceClient();
  const url = new URL(req.url);

  // ---- OAuth callback from eBay ----
  if (req.method === 'GET' && (url.searchParams.get('code') || url.searchParams.get('error'))) {
    const rawState = url.searchParams.get('state');
    const stateKey = rawState ? decodeURIComponent(rawState) : '';
    let origin = safeOrigin(rawState);
    let environment = envFromState(rawState);
    try {
      const error = url.searchParams.get('error');
      if (error) throw new Error(url.searchParams.get('error_description') || error);

      // Which dealership started this connection?
      const { data: stateRow } = await supabase
        .from('ebay_oauth_states')
        .select('*')
        .eq('state', stateKey)
        .maybeSingle();
      if (!stateRow) throw new Error('This eBay connection link has expired — please try connecting again.');
      await supabase.from('ebay_oauth_states').delete().eq('state', stateKey);

      const record = stateRow as {
        business_id: string; environment: string; origin: string | null; created_at: string;
      };
      if (Date.now() - Date.parse(record.created_at) > 15 * 60_000) {
        throw new Error('This eBay connection link has expired — please try connecting again.');
      }
      const businessId = record.business_id;
      environment = record.environment === 'production' ? 'production' : 'sandbox';
      if (record.origin) origin = record.origin;

      const tokens = await exchangeCode(environment, url.searchParams.get('code')!);
      await saveSettings(supabase, businessId, {
        environment,
        refresh_token: tokens.refresh_token,
        access_token: tokens.access_token,
        access_token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        connected_at: new Date().toISOString(),
        marketplace_id: 'EBAY_GB',
        currency: 'GBP',
      });

      try {
        const conn = await requireConnection(supabase, businessId);
        const me = await ebayFetch<any>(conn, '/commerce/identity/v1/user/');
        if (me?.username) await saveSettings(supabase, businessId, { seller_name: me.username });
      } catch (e) {
        console.error('Could not read eBay account name:', (e as Error).message);
      }

      return backToApp(origin, { ebay: 'connected' });
    } catch (e) {
      console.error('eBay callback error', e);
      return backToApp(origin, { ebay: 'error', message: String((e as Error).message).slice(0, 300) });
    }
  }

  // ---- Authenticated JSON API ----
  let userId: string;
  let businessId: string;
  try {
    const user = await requireUser(req, supabase);
    await requireRole(supabase, user.id, ['admin', 'owner']);
    userId = user.id;
    businessId = await businessIdForUser(supabase, user.id);
  } catch (e) {
    return json({ error: (e as Error).message }, 401);
  }

  try {
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const action = body.action || url.searchParams.get('action') || 'status';

    if (action === 'status') {
      const row = await loadIntegration(supabase, businessId);
      const s = ((row?.settings ?? {}) as EbaySettings) || {};
      return json({
        connected: Boolean(row?.is_active && s.refresh_token),
        environment: s.environment ?? 'sandbox',
        seller_name: s.seller_name ?? null,
        connected_at: s.connected_at ?? null,
        auto_list: s.auto_list ?? true,
        category_id: s.category_id ?? '',
        condition: s.condition ?? 'USED_EXCELLENT',
        postcode: s.postcode ?? '',
        fulfillment_policy_id: s.fulfillment_policy_id ?? '',
        payment_policy_id: s.payment_policy_id ?? '',
        return_policy_id: s.return_policy_id ?? '',
        callback_url: redirectUri(),
      });
    }

    if (action === 'auth_url') {
      const clientId = Deno.env.get('EBAY_CLIENT_ID');
      const ruName = Deno.env.get('EBAY_RU_NAME');
      if (!clientId) throw new Error('EBAY_CLIENT_ID is not configured');
      if (!ruName) throw new Error('EBAY_RU_NAME is not configured');
      const environment: EbayEnvironment = body.environment === 'production' ? 'production' : 'sandbox';
      const origin = typeof body.origin === 'string' && /^https?:\/\//.test(body.origin)
        ? body.origin.replace(/\/+$/, '')
        : FALLBACK_APP_ORIGIN;
      const state = `${origin}|${crypto.randomUUID()}|${environment}`;

      // Remember which dealership is connecting so the callback lands on the right account.
      await supabase.from('ebay_oauth_states').delete().eq('business_id', businessId);
      const { error: stateError } = await supabase.from('ebay_oauth_states').insert({
        state,
        business_id: businessId,
        user_id: userId,
        environment,
        origin,
      });
      if (stateError) throw new Error(stateError.message);

      const authUrl = `${authBase(environment)}/oauth2/authorize?` + new URLSearchParams({
        client_id: clientId,
        redirect_uri: ruName,
        response_type: 'code',
        scope: EBAY_SCOPES,
        state: encodeURIComponent(state),
        prompt: 'login',
      });
      return json({ url: authUrl });
    }

    if (action === 'save_settings') {
      const clean = (v: unknown, max = 80) =>
        typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined;
      const settings = await saveSettings(supabase, businessId, {
        auto_list: Boolean(body.auto_list),
        category_id: clean(body.category_id, 20),
        condition: clean(body.condition, 40),
        postcode: clean(body.postcode, 12),
        fulfillment_policy_id: clean(body.fulfillment_policy_id, 60),
        payment_policy_id: clean(body.payment_policy_id, 60),
        return_policy_id: clean(body.return_policy_id, 60),
      });
      return json({ ok: true, auto_list: settings.auto_list });
    }

    if (action === 'policies') {
      const conn = await requireConnection(supabase, businessId);
      const marketplace = conn.settings.marketplace_id || 'EBAY_GB';
      const get = async (kind: PolicyKind, key: string) => {
        try {
          const data = await ebayFetch<any>(
            conn,
            `/sell/account/v1/${POLICY_PATH[kind]}?marketplace_id=${marketplace}`,
          );
          return (data?.[key] ?? [])
            .map((p: any) => summarisePolicy(kind, p))
            .filter((p: any) => p.id);
        } catch (e) {
          console.error(`eBay ${kind} lookup failed:`, (e as Error).message);
          return [];
        }
      };
      const [fulfillment, payment, returns] = await Promise.all([
        get('fulfillment', 'fulfillmentPolicies'),
        get('payment', 'paymentPolicies'),
        get('returns', 'returnPolicies'),
      ]);
      return json({ fulfillment, payment, returns });
    }

    if (action === 'shipping_services') {
      return json({ services: UK_SHIPPING_SERVICES });
    }

    if (action === 'save_policy') {
      const conn = await requireConnection(supabase, businessId);
      const kind = String(body.kind ?? '') as PolicyKind;
      if (!POLICY_PATH[kind]) return json({ error: 'Unknown policy type' }, 400);

      const marketplace = conn.settings.marketplace_id || 'EBAY_GB';
      const currency = conn.settings.currency || 'GBP';
      let payload: Record<string, unknown>;
      try {
        payload = buildPolicyBody(kind, body, marketplace, currency);
      } catch (e) {
        return json({ error: (e as Error).message }, 400);
      }

      const policyId = typeof body.policy_id === 'string' && body.policy_id.trim()
        ? body.policy_id.trim()
        : null;
      const path = policyId
        ? `/sell/account/v1/${POLICY_PATH[kind]}/${encodeURIComponent(policyId)}`
        : `/sell/account/v1/${POLICY_PATH[kind]}`;

      const saved = await ebayFetch<any>(conn, path, {
        method: policyId ? 'PUT' : 'POST',
        body: JSON.stringify(payload),
      });
      return json({ ok: true, policy: summarisePolicy(kind, saved ?? { ...payload, ...idField(kind, policyId) }) });
    }

    if (action === 'delete_policy') {
      const conn = await requireConnection(supabase, businessId);
      const kind = String(body.kind ?? '') as PolicyKind;
      const policyId = String(body.policy_id ?? '').trim();
      if (!POLICY_PATH[kind]) return json({ error: 'Unknown policy type' }, 400);
      if (!policyId) return json({ error: 'Choose a policy to delete' }, 400);

      await ebayFetch(conn, `/sell/account/v1/${POLICY_PATH[kind]}/${encodeURIComponent(policyId)}`, {
        method: 'DELETE',
      });
      return json({ ok: true });
    }

    if (action === 'categories') {
      const conn = await requireConnection(supabase, businessId);
      const query = String(body.query ?? 'bicycle').slice(0, 60);
      const treeId = conn.settings.marketplace_id === 'EBAY_US' ? '0' : '3';
      const data = await ebayFetch<any>(
        conn,
        `/commerce/taxonomy/v1/category_tree/${treeId}/get_category_suggestions?q=${encodeURIComponent(query)}`,
      );
      return json({
        categories: (data?.categorySuggestions ?? []).slice(0, 10).map((c: any) => ({
          id: c.category?.categoryId,
          name: [...(c.categoryTreeNodeAncestors ?? [])].reverse().map((a: any) => a.categoryName)
            .concat(c.category?.categoryName)
            .filter(Boolean)
            .join(' › '),
        })),
      });
    }

    if (action === 'disconnect') {
      const row = await loadIntegration(supabase, businessId);
      await supabase.from('ebay_oauth_states').delete().eq('business_id', businessId);
      if (row) {
        const { error } = await supabase
          .from('integrations')
          .update({ settings: {}, is_active: false, updated_at: new Date().toISOString() })
          .eq('id', (row as { id: string }).id);
        if (error) throw new Error(error.message);
      }
      console.log(`eBay disconnected by ${userId}`);
      return json({ ok: true });
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (e) {
    console.error('ebay-oauth error:', (e as Error).message);
    return json({ error: (e as Error).message }, 400);
  }
});
