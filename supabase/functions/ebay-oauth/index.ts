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
  POLICY_OPT_IN_MESSAGE,
  authBase,
  redirectUri,
  EBAY_SCOPES,
  hasCurrentScopes,
  ebayCredentials,
  loadSettings,
  modeStatus,
  clearMode,
  type EbayEnvironment,
  type EbaySettings,
} from '../_shared/ebay.ts';
import { allowedOrigin, classifyCallback, DEFAULT_APP_ORIGIN } from '../_shared/ebay-oauth-origin.ts';
import { ensureLocation, heldLocation } from '../_shared/ebay-listing.ts';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const FALLBACK_APP_ORIGIN = DEFAULT_APP_ORIGIN;

const backToApp = (origin: string, params: Record<string, string>) => {
  const qs = new URLSearchParams({ tab: 'integrations', ...params });
  return new Response(null, { status: 302, headers: { Location: `${allowedOrigin(origin)}/settings?${qs}` } });
};

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
  const callbackKind = req.method === 'GET' ? classifyCallback(url.searchParams) : 'none';
  if (callbackKind !== 'none') {
    const stateKey = url.searchParams.get('state') ?? '';
    let origin = FALLBACK_APP_ORIGIN;
    if (stateKey) {
      const { data: row } = await supabase.from('ebay_oauth_states').select('origin').eq('state', stateKey).maybeSingle();
      if (row?.origin) origin = allowedOrigin(row.origin);
    }
    if (callbackKind === 'declined') {
      if (stateKey) await supabase.from('ebay_oauth_states').delete().eq('state', stateKey);
      return backToApp(origin, { ebay: 'cancelled' });
    }
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
      if (record.origin) origin = allowedOrigin(record.origin);

      const tokens = await exchangeCode(environment, url.searchParams.get('code')!);
      await saveSettings(supabase, businessId, {
        environment,
        refresh_token: tokens.refresh_token,
        access_token: tokens.access_token,
        access_token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        connected_at: new Date().toISOString(),
        marketplace_id: 'EBAY_GB',
        currency: 'GBP',
        granted_scopes: EBAY_SCOPES,
        refresh_token_expires_at: tokens.refresh_token_expires_in
          ? new Date(Date.now() + tokens.refresh_token_expires_in * 1000).toISOString()
          : undefined,
        needs_reauth: false,
      }, true, environment);

      try {
        const conn = await requireConnection(supabase, businessId, environment);
        const me = await ebayFetch<any>(conn, '/commerce/identity/v1/user/');
        if (me?.username) await saveSettings(supabase, businessId, { seller_name: me.username }, true, environment);
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
  let role: string;
  try {
    const user = await requireUser(req, supabase);
    role = await requireRole(supabase, user.id, ['admin', 'owner', 'customer_service', 'mechanic', 'detailer', 'accountant', 'social_manager']);
    userId = user.id;
    businessId = await businessIdForUser(supabase, user.id);
  } catch (e) {
    return json({ error: (e as Error).message }, 401);
  }

  try {
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const action = body.action || url.searchParams.get('action') || 'status';
    const manager = role === 'admin' || role === 'owner';
    if (!manager && !['status', 'categories'].includes(action)) {
      return json({ error: 'You do not have permission to do that' }, 403);
    }

    if (action === 'status') {
      const row = await loadIntegration(supabase, businessId);
      const s = await loadSettings(supabase, businessId);
      const { data: biz } = await supabase.from('businesses').select('name').eq('id', businessId).maybeSingle();
      return json({
        connected: Boolean(row?.is_active && s.refresh_token),
        environment: s.environment ?? 'sandbox',
        modes: modeStatus(s),
        seller_name: s.seller_name ?? null,
        connected_at: s.connected_at ?? null,
        auto_list: s.auto_list ?? true,
        category_id: s.category_id ?? '',
        condition: s.condition ?? 'USED_EXCELLENT',
        postcode: s.postcode ?? '',
        location_name: s.location_name ?? '',
        address_line1: s.address_line1 ?? '',
        city: s.city ?? '',
        country: s.country ?? 'GB',
        business_name: (biz as any)?.name ?? '',
        fulfillment_policy_id: s.fulfillment_policy_id ?? '',
        payment_policy_id: s.payment_policy_id ?? '',
        return_policy_id: s.return_policy_id ?? '',
        callback_url: redirectUri(),
        needs_reconnect: Boolean(row?.is_active && s.refresh_token) && !hasCurrentScopes(s),
        category_by_type: s.category_by_type ?? {},
        best_offer_enabled: s.best_offer_enabled ?? false,
        best_offer_accept_pct: manager ? (s.best_offer_accept_pct ?? 95) : null,
        best_offer_decline_pct: manager ? (s.best_offer_decline_pct ?? 80) : null,
        promote_enabled: s.promote_enabled ?? false,
        promote_auto: s.promote_auto ?? false,
        ad_rate: s.ad_rate ?? 5,
        can_manage: manager,
      });
    }

    if (action === 'location') {
      const conn = await requireConnection(supabase, businessId);
      return json({ held: await heldLocation(conn) });
    }

    if (action === 'auth_url') {
      const environment: EbayEnvironment = body.environment === 'production' ? 'production' : 'sandbox';
      const creds = ebayCredentials(environment);
      const clientId = creds.id;
      const ruName = creds.ruName;
      if (!ruName) {
        throw new Error(environment === 'production'
          ? 'Live eBay sign-in is not set up yet (missing live RuName).'
          : 'EBAY_RU_NAME is not configured');
      }
      const origin = allowedOrigin(body.origin);
      const state = `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, '');

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
        state,
        prompt: 'login',
      });
      return json({ url: authUrl });
    }

    if (action === 'save_settings') {
      const clean = (v: unknown, max = 80) =>
        typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined;
      const postcode = clean(body.postcode, 12)?.toUpperCase();
      const city = clean(body.city, 80);
      const country = (clean(body.country, 2) || 'GB').toUpperCase();
      if (!postcode || !city) {
        return json({ error: 'Enter the town and postcode your bikes are sent from.' }, 400);
      }
      if (country === 'GB' && !/^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/.test(postcode)) {
        return json({ error: 'That doesn\'t look like a UK postcode.' }, 400);
      }
      const settings = await saveSettings(supabase, businessId, {
        auto_list: Boolean(body.auto_list),
        category_id: clean(body.category_id, 20),
        condition: clean(body.condition, 40),
        postcode,
        city,
        country,
        location_name: clean(body.location_name, 80) ?? '',
        address_line1: clean(body.address_line1, 120) ?? '',
        fulfillment_policy_id: clean(body.fulfillment_policy_id, 60),
        payment_policy_id: clean(body.payment_policy_id, 60),
        return_policy_id: clean(body.return_policy_id, 60),
      });
      // Push the address to eBay straight away so live listings show the right town.
      let locationError: string | null = null;
      try {
        const conn = await requireConnection(supabase, businessId);
        await ensureLocation(supabase, conn, businessId);
      } catch (e) {
        locationError = (e as Error).message;
        console.warn('Could not update eBay despatch location:', locationError);
      }
      return json({ ok: true, auto_list: settings.auto_list, location_error: locationError });
    }

    if (action === 'save_listing_settings') {
      const pct = (v: unknown, def: number) => {
        const n = Number(v);
        return Number.isFinite(n) && n >= 1 && n <= 100 ? Math.round(n * 10) / 10 : def;
      };
      const byType: Record<string, string> = {};
      if (body.category_by_type && typeof body.category_by_type === 'object') {
        for (const [k, v] of Object.entries(body.category_by_type as Record<string, unknown>)) {
          const id = String(v ?? '').trim();
          if (/^[a-z_]{1,30}$/.test(k) && /^\d{1,12}$/.test(id)) byType[k] = id;
        }
      }
      const accept = pct(body.best_offer_accept_pct, 95);
      const decline = pct(body.best_offer_decline_pct, 80);
      if (decline >= accept) return json({ error: 'Auto-decline must be lower than auto-accept.' }, 400);
      const rate = Number(body.ad_rate);
      if (body.promote_enabled && !(rate >= 2 && rate <= 100)) {
        return json({ error: 'Ad rate must be between 2% and 100%.' }, 400);
      }
      await saveSettings(supabase, businessId, {
        category_by_type: byType,
        best_offer_enabled: Boolean(body.best_offer_enabled),
        best_offer_accept_pct: accept,
        best_offer_decline_pct: decline,
        promote_enabled: Boolean(body.promote_enabled),
        promote_auto: Boolean(body.promote_auto),
        ad_rate: Number.isFinite(rate) && rate > 0 ? Math.round(rate * 10) / 10 : 5,
      });
      return json({ ok: true });
    }

    if (action === 'suggest_category') {
      const conn = await requireConnection(supabase, businessId);
      const query = String(body.query ?? '').slice(0, 60) || 'bike';
      const treeId = conn.settings.marketplace_id === 'EBAY_US' ? '0' : '3';
      const data = await ebayFetch<any>(
        conn,
        `/commerce/taxonomy/v1/category_tree/${treeId}/get_category_suggestions?q=${encodeURIComponent(query)}`,
      );
      const first = (data?.categorySuggestions ?? [])[0];
      return json({
        category: first ? {
          id: first.category?.categoryId,
          name: [...(first.categoryTreeNodeAncestors ?? [])].reverse().map((a: any) => a.categoryName)
            .concat(first.category?.categoryName).filter(Boolean).join(' › '),
        } : null,
      });
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

    if (action === 'switch_mode') {
      if (body.environment !== 'production' && body.environment !== 'sandbox') {
        return json({ error: 'Choose test or live.' }, 400);
      }
      const current = await loadSettings(supabase, businessId);
      const modes = modeStatus(current);
      await saveSettings(supabase, businessId, { environment: body.environment }, modes.sandbox.connected || modes.production.connected);
      console.log(`eBay mode switched to ${body.environment} by ${userId}`);
      return json({ ok: true, environment: body.environment, connected: modes[body.environment as EbayEnvironment].connected });
    }

    if (action === 'disconnect') {
      const current = await loadSettings(supabase, businessId);
      const mode: EbayEnvironment = body.environment === 'production' || body.environment === 'sandbox'
        ? body.environment
        : (current.environment ?? 'sandbox');
      await supabase.from('ebay_oauth_states').delete().eq('business_id', businessId);
      await clearMode(supabase, businessId, mode);
      console.log(`eBay ${mode} disconnected by ${userId}`);
      return json({ ok: true });
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (e) {
    console.error('ebay-oauth error:', (e as Error).message);
    return json({ error: (e as Error).message }, 400);
  }
});
