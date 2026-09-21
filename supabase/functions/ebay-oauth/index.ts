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

// ---- Business policies (Sell Account API v1) ----
type PolicyKind = 'fulfillment' | 'payment' | 'returns';

const POLICY_PATH: Record<PolicyKind, string> = {
  fulfillment: 'fulfillment_policy',
  payment: 'payment_policy',
  returns: 'return_policy',
};

const CATEGORY_TYPES = [{ name: 'ALL_EXCLUDING_MOTORS_VEHICLES' }];

/** Common UK postage services offered in the postage form. */
const UK_SHIPPING_SERVICES = [
  { code: 'UK_OtherCourier3Days', name: 'Courier — 3 days or less' },
  { code: 'UK_OtherCourier', name: 'Courier — standard' },
  { code: 'UK_RoyalMailSecondClassStandard', name: 'Royal Mail 2nd Class' },
  { code: 'UK_RoyalMailFirstClassStandard', name: 'Royal Mail 1st Class' },
  { code: 'UK_RoyalMailSpecialDelivery', name: 'Royal Mail Special Delivery' },
  { code: 'UK_Parcelforce24', name: 'Parcelforce 24' },
  { code: 'UK_Parcelforce48', name: 'Parcelforce 48' },
  { code: 'UK_ParcelForceIntlDatapost', name: 'Parcelforce — other' },
];

const RETURN_PERIODS = [14, 30, 60];
const HANDLING_DAYS = [0, 1, 2, 3, 5];

const idField = (kind: PolicyKind, id: string | null) =>
  id
    ? {
      fulfillment: { fulfillmentPolicyId: id },
      payment: { paymentPolicyId: id },
      returns: { returnPolicyId: id },
    }[kind]
    : {};

/** Flattens an eBay policy into the shape the settings forms use. */
function summarisePolicy(kind: PolicyKind, p: any) {
  const base = {
    id: p?.fulfillmentPolicyId ?? p?.paymentPolicyId ?? p?.returnPolicyId ?? null,
    name: p?.name ?? '',
    description: p?.description ?? '',
  };
  if (kind === 'payment') {
    return { ...base, immediate_pay: Boolean(p?.immediatePay) };
  }
  if (kind === 'returns') {
    return {
      ...base,
      returns_accepted: Boolean(p?.returnsAccepted),
      return_period_days: Number(p?.returnPeriod?.value ?? 30),
      return_shipping_cost_payer: p?.returnShippingCostPayer ?? 'BUYER',
      refund_method: p?.refundMethod ?? 'MONEY_BACK',
    };
  }
  const domestic = (p?.shippingOptions ?? []).find((o: any) => o?.optionType === 'DOMESTIC');
  const service = domestic?.shippingServices?.[0];
  return {
    ...base,
    handling_time_days: Number(p?.handlingTime?.value ?? 1),
    shipping_service_code: service?.shippingServiceCode ?? UK_SHIPPING_SERVICES[0].code,
    free_shipping: Boolean(service?.freeShipping),
    shipping_cost: Number(service?.shippingCost?.value ?? 0),
    local_pickup: Boolean(p?.pickupDropOff || p?.localPickup),
  };
}

/** Validates the submitted form and builds the eBay request body. */
function buildPolicyBody(
  kind: PolicyKind,
  body: Record<string, any>,
  marketplaceId: string,
  currency: string,
): Record<string, unknown> {
  const name = String(body.name ?? '').trim();
  if (name.length < 1 || name.length > 64) {
    throw new Error('Give the policy a name of up to 64 characters.');
  }
  const description = String(body.description ?? '').trim().slice(0, 250);
  const base = { name, description, marketplaceId, categoryTypes: CATEGORY_TYPES };

  if (kind === 'payment') {
    return { ...base, immediatePay: Boolean(body.immediate_pay) };
  }

  if (kind === 'returns') {
    const returnsAccepted = Boolean(body.returns_accepted);
    if (!returnsAccepted) return { ...base, returnsAccepted: false };
    const days = Number(body.return_period_days);
    if (!RETURN_PERIODS.includes(days)) throw new Error('Choose a return window of 14, 30 or 60 days.');
    const payer = String(body.return_shipping_cost_payer ?? 'BUYER');
    if (!['BUYER', 'SELLER'].includes(payer)) throw new Error('Choose who pays the return postage.');
    const refund = String(body.refund_method ?? 'MONEY_BACK');
    if (!['MONEY_BACK', 'MONEY_BACK_OR_REPLACEMENT'].includes(refund)) {
      throw new Error('Choose a valid refund method.');
    }
    return {
      ...base,
      returnsAccepted: true,
      returnPeriod: { value: days, unit: 'DAY' },
      returnShippingCostPayer: payer,
      refundMethod: refund,
    };
  }

  const handling = Number(body.handling_time_days ?? 1);
  if (!HANDLING_DAYS.includes(handling)) throw new Error('Choose a valid handling time.');
  const serviceCode = String(body.shipping_service_code ?? '');
  if (!UK_SHIPPING_SERVICES.some((s) => s.code === serviceCode)) {
    throw new Error('Choose a postage service.');
  }
  const free = Boolean(body.free_shipping);
  const cost = Number(body.shipping_cost ?? 0);
  if (!free && (!Number.isFinite(cost) || cost < 0 || cost > 10000)) {
    throw new Error('Enter a postage cost between 0 and 10,000.');
  }

  return {
    ...base,
    handlingTime: { value: handling, unit: 'DAY' },
    pickupDropOff: Boolean(body.local_pickup),
    shippingOptions: [
      {
        optionType: 'DOMESTIC',
        costType: 'FLAT_RATE',
        shippingServices: [
          {
            sortOrder: 1,
            shippingServiceCode: serviceCode,
            freeShipping: free,
            ...(free ? {} : { shippingCost: { value: cost.toFixed(2), currency } }),
          },
        ],
      },
    ],
  };
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
      let optInRequired = false;
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
          const message = (e as Error).message;
          if (message === POLICY_OPT_IN_MESSAGE) optInRequired = true;
          console.error(`eBay ${kind} lookup failed:`, message);
          return [];
        }
      };
      const [fulfillment, payment, returns] = await Promise.all([
        get('fulfillment', 'fulfillmentPolicies'),
        get('payment', 'paymentPolicies'),
        get('returns', 'returnPolicies'),
      ]);
      return json({ fulfillment, payment, returns, opt_in_required: optInRequired });
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
