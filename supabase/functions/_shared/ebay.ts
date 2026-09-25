// Shared eBay helpers for edge functions.
import { createClient } from 'npm:@supabase/supabase-js@2';

export const EBAY_INTEGRATION_NAME = 'ebay';

/** Scopes requested by connections made before sale sync and promotion were added. */
export const LEGACY_SCOPES = [
  'https://api.ebay.com/oauth/api_scope',
  'https://api.ebay.com/oauth/api_scope/sell.inventory',
  'https://api.ebay.com/oauth/api_scope/sell.account',
  'https://api.ebay.com/oauth/api_scope/sell.fulfillment',
  'https://api.ebay.com/oauth/api_scope/commerce.identity.readonly',
].join(' ');

export const EBAY_SCOPES = [
  LEGACY_SCOPES,
  'https://api.ebay.com/oauth/api_scope/sell.marketing',
].join(' ');

/** True when the saved connection was granted every scope we now ask for. */
export function hasCurrentScopes(settings: EbaySettings): boolean {
  return Boolean(settings.granted_scopes) && EBAY_SCOPES.split(' ').every((s) => settings.granted_scopes!.split(' ').includes(s));
}
export function hasScope(settings: EbaySettings, suffix: string): boolean {
  return (settings.granted_scopes || LEGACY_SCOPES).split(' ').some((s) => s.endsWith(`/${suffix}`));
}

export type EbayEnvironment = 'sandbox' | 'production';

export interface EbaySettings {
  environment?: EbayEnvironment;
  refresh_token?: string;
  access_token?: string;
  access_token_expires_at?: string;
  seller_name?: string;
  marketplace_id?: string;
  connected_at?: string;
  auto_list?: boolean;
  category_id?: string;
  condition?: string;
  merchant_location_key?: string;
  postcode?: string;
  location_name?: string;
  address_line1?: string;
  city?: string;
  country?: string;
  fulfillment_policy_id?: string;
  payment_policy_id?: string;
  return_policy_id?: string;
  currency?: string;
  granted_scopes?: string;
  category_by_type?: Record<string, string>;
  best_offer_enabled?: boolean;
  best_offer_accept_pct?: number;
  best_offer_decline_pct?: number;
  promote_enabled?: boolean;
  promote_auto?: boolean;
  ad_rate?: number;
  campaign_id?: string;
  last_order_sync_at?: string;
}

export type Client = ReturnType<typeof serviceClient>;

export function serviceClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );
}

export function functionsBase() {
  return (
    Deno.env.get('PUBLIC_FUNCTIONS_BASE_URL') || `${Deno.env.get('SUPABASE_URL')}/functions/v1`
  ).trim().replace(/\/+$/, '');
}

export function redirectUri() {
  return `${functionsBase()}/ebay-oauth`;
}

export function apiBase(env: EbayEnvironment) {
  return env === 'production' ? 'https://api.ebay.com' : 'https://api.sandbox.ebay.com';
}

export function authBase(env: EbayEnvironment) {
  return env === 'production' ? 'https://auth.ebay.com' : 'https://auth.sandbox.ebay.com';
}

export function itemBase(env: EbayEnvironment) {
  return env === 'production' ? 'https://www.ebay.co.uk/itm/' : 'https://www.sandbox.ebay.co.uk/itm/';
}


/** The dealership a signed-in user belongs to. */
export async function businessIdForUser(supabase: Client, userId: string): Promise<string> {
  const { data, error } = await supabase
    .from('profiles')
    .select('business_id')
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !data?.business_id) throw new Error('Could not work out which dealership you belong to');
  return (data as { business_id: string }).business_id;
}

/** The dealership a bike belongs to. */
export async function businessIdForBike(supabase: Client, bikeId: string): Promise<string> {
  const { data, error } = await supabase
    .from('bikes')
    .select('business_id')
    .eq('id', bikeId)
    .maybeSingle();
  if (error || !data?.business_id) throw new Error('Bike not found');
  return (data as { business_id: string }).business_id;
}

export async function loadIntegration(supabase: Client, businessId: string) {
  const { data, error } = await supabase
    .from('integrations')
    .select('*')
    .eq('name', EBAY_INTEGRATION_NAME)
    .eq('business_id', businessId)
    .maybeSingle();
  if (error) throw new Error(`Failed to load eBay integration: ${error.message}`);
  return data;
}

/** Fields that belong to one eBay account/mode (test or live) rather than the dealership. */
const SLOT_FIELDS = [
  'refresh_token', 'access_token', 'access_token_expires_at', 'seller_name', 'connected_at',
  'granted_scopes', 'fulfillment_policy_id', 'payment_policy_id', 'return_policy_id',
  'merchant_location_key', 'campaign_id', 'last_order_sync_at',
] as const;
type Slot = Partial<Pick<EbaySettings, typeof SLOT_FIELDS[number]>>;
type StoredSettings = EbaySettings & { tokens?: Partial<Record<EbayEnvironment, Slot>> };

function pickSlot(s: Record<string, unknown>): Slot {
  const out: Record<string, unknown> = {};
  for (const k of SLOT_FIELDS) if (k in s) out[k] = s[k];
  return out as Slot;
}
function withoutSlot(s: Record<string, unknown>): Record<string, unknown> {
  const out = { ...s };
  for (const k of SLOT_FIELDS) delete out[k];
  delete out.tokens;
  return out;
}

/** Normalises stored settings into per-mode token slots (legacy flat tokens → their mode's slot). */
function normalise(raw: StoredSettings): { env: EbayEnvironment; tokens: Partial<Record<EbayEnvironment, Slot>>; shared: Record<string, unknown> } {
  const env: EbayEnvironment = raw.environment === 'production' ? 'production' : 'sandbox';
  const tokens = { ...(raw.tokens ?? {}) };
  const legacy = pickSlot(raw as Record<string, unknown>);
  if (Object.keys(legacy).length && !tokens[env]) tokens[env] = legacy;
  return { env, tokens, shared: withoutSlot(raw as Record<string, unknown>) };
}

function view(env: EbayEnvironment, tokens: Partial<Record<EbayEnvironment, Slot>>, shared: Record<string, unknown>): EbaySettings {
  return { ...shared, ...(tokens[env] ?? {}), environment: env, tokens } as EbaySettings;
}

/** Settings for the dealership's active mode, with that mode's tokens on top. */
export async function loadSettings(supabase: Client, businessId: string, mode?: EbayEnvironment): Promise<EbaySettings> {
  const row = await loadIntegration(supabase, businessId);
  const { env, tokens, shared } = normalise(((row?.settings ?? {}) as StoredSettings) || {});
  return view(mode ?? env, tokens, shared);
}

/** Connection status of each mode. */
export function modeStatus(settings: EbaySettings) {
  const tokens = ((settings as StoredSettings).tokens ?? {});
  const one = (e: EbayEnvironment) => ({
    connected: Boolean(tokens[e]?.refresh_token),
    seller_name: tokens[e]?.seller_name ?? null,
    connected_at: tokens[e]?.connected_at ?? null,
  });
  return { sandbox: one('sandbox'), production: one('production') };
}

/**
 * Saves settings. Account fields go into the slot of `patch.environment` (or the active mode);
 * dealership-wide fields are shared. Passing `environment` alone switches the active mode.
 */
export async function saveSettings(
  supabase: Client,
  businessId: string,
  settings: EbaySettings,
  isActive = true,
  slotMode?: EbayEnvironment,
): Promise<EbaySettings> {
  const existing = await loadIntegration(supabase, businessId);
  const cur = normalise(((existing?.settings as StoredSettings) ?? {}) as StoredSettings);
  const active: EbayEnvironment = settings.environment === 'production'
    ? 'production'
    : settings.environment === 'sandbox' ? 'sandbox' : cur.env;
  const env: EbayEnvironment = slotMode ?? active;
  const tokens = { ...cur.tokens, [env]: { ...(cur.tokens[env] ?? {}), ...pickSlot(settings as Record<string, unknown>) } };
  const shared = { ...cur.shared, ...withoutSlot(settings as Record<string, unknown>), environment: active };
  const stored = { ...shared, tokens };
  if (existing) {
    const { error } = await supabase
      .from('integrations')
      .update({ settings: stored, is_active: isActive, updated_at: new Date().toISOString() })
      .eq('id', (existing as { id: string }).id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from('integrations').insert({
      name: EBAY_INTEGRATION_NAME,
      display_name: 'eBay',
      is_active: isActive,
      business_id: businessId,
      settings: stored,
    });
    if (error) throw new Error(error.message);
  }
  return view(env, tokens, shared);
}

/** Removes one mode's account tokens; the other mode and dealership settings stay. */
export async function clearMode(supabase: Client, businessId: string, mode: EbayEnvironment) {
  const existing = await loadIntegration(supabase, businessId);
  if (!existing) return;
  const cur = normalise(((existing.settings as StoredSettings) ?? {}) as StoredSettings);
  const tokens = { ...cur.tokens };
  delete tokens[mode];
  const anyLeft = Object.values(tokens).some((t) => t?.refresh_token);
  const { error } = await supabase
    .from('integrations')
    .update({ settings: { ...cur.shared, environment: cur.env, tokens }, is_active: anyLeft, updated_at: new Date().toISOString() })
    .eq('id', (existing as { id: string }).id);
  if (error) throw new Error(error.message);
}

/** App keyset for each mode. */
export function ebayCredentials(env: EbayEnvironment) {
  const prod = env === 'production';
  const id = Deno.env.get(prod ? 'EBAY_PROD_CLIENT_ID' : 'EBAY_CLIENT_ID');
  const secret = Deno.env.get(prod ? 'EBAY_PROD_CLIENT_SECRET' : 'EBAY_CLIENT_SECRET');
  const ruName = Deno.env.get(prod ? 'EBAY_PROD_RU_NAME' : 'EBAY_RU_NAME');
  const label = prod ? 'live' : 'test';
  if (!id || !secret) throw new Error(`eBay ${label} app keys are not configured`);
  return { id, secret, ruName, basic: btoa(`${id}:${secret}`) };
}

/** Swaps an authorisation code for refresh + access tokens. */
export async function exchangeCode(env: EbayEnvironment, code: string) {
  const creds = ebayCredentials(env);
  const ruName = creds.ruName;
  if (!ruName) throw new Error(`eBay ${env === 'production' ? 'live' : 'test'} RuName is not configured`);
  const res = await fetch(`${apiBase(env)}/identity/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${creds.basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: ruName,
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`eBay token exchange failed [${res.status}]: ${text}`);
  return JSON.parse(text) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    refresh_token_expires_in: number;
  };
}

async function refreshAccessToken(env: EbayEnvironment, refreshToken: string) {
  const res = await fetch(`${apiBase(env)}/identity/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${ebayCredentials(env).basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      scope: EBAY_SCOPES,
    }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(
      res.status === 400 || res.status === 401
        ? 'eBay sign-in has expired — reconnect eBay in Settings → Integrations.'
        : `eBay token refresh failed [${res.status}]: ${text}`,
    );
  }
  return JSON.parse(text) as { access_token: string; expires_in: number };
}

export interface Connection {
  environment: EbayEnvironment;
  accessToken: string;
  settings: EbaySettings;
}

/** Returns a valid access token for one dealership, refreshing and storing it when needed. */
export async function requireConnection(supabase: Client, businessId: string, mode?: EbayEnvironment): Promise<Connection> {
  const settings = await loadSettings(supabase, businessId, mode);
  const env: EbayEnvironment = settings.environment === 'production' ? 'production' : 'sandbox';
  if (!settings.refresh_token) {
    throw new Error(`eBay ${env === 'production' ? 'live' : 'test'} mode is not connected — connect it (or switch mode) in Settings → Integrations.`);
  }

  const expires = settings.access_token_expires_at ? Date.parse(settings.access_token_expires_at) : 0;
  if (settings.access_token && expires - 60_000 > Date.now()) {
    return { environment: env, accessToken: settings.access_token, settings };
  }

  const fresh = await refreshAccessToken(env, settings.refresh_token);
  await saveSettings(supabase, businessId, {
    access_token: fresh.access_token,
    access_token_expires_at: new Date(Date.now() + fresh.expires_in * 1000).toISOString(),
  }, true, env);
  const merged = await loadSettings(supabase, businessId, env);
  return { environment: env, accessToken: fresh.access_token, settings: merged };
}

export const POLICY_OPT_IN_MESSAGE =
  'This eBay account has not turned on business policies yet. Open business policies on eBay, switch them on, then try again.';

/** True when eBay rejected the call because the seller has not opted in to business policies. */
export function isOptInError(text: string): boolean {
  return /20403/.test(text)
    || /not opted in to business polic/i.test(text)
    || /not eligible for business polic/i.test(text);
}

/** Language tag eBay expects for each marketplace. */
const MARKETPLACE_LANGUAGE: Record<string, string> = {
  EBAY_GB: 'en-GB',
  EBAY_US: 'en-US',
  EBAY_AU: 'en-AU',
  EBAY_IE: 'en-IE',
  EBAY_CA: 'en-CA',
  EBAY_DE: 'de-DE',
  EBAY_FR: 'fr-FR',
  EBAY_IT: 'it-IT',
  EBAY_ES: 'es-ES',
};

/** eBay REST helper. Throws with eBay's own message on failure. */
export async function ebayFetch<T = any>(
  conn: Connection,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const marketplace = conn.settings.marketplace_id || 'EBAY_GB';
  const language = MARKETPLACE_LANGUAGE[marketplace] || 'en-GB';
  const res = await fetch(`${apiBase(conn.environment)}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${conn.accessToken}`,
      Accept: 'application/json',
      'Accept-Language': language,
      'Content-Language': language,
      'X-EBAY-C-MARKETPLACE-ID': marketplace,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers as Record<string, string> | undefined),
    },
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`eBay request failed [${res.status}] ${path}: ${text}`);
    if (isOptInError(text)) throw new Error(POLICY_OPT_IN_MESSAGE);
    throw new Error(`eBay request failed [${res.status}]: ${ebayMessage(text)}`);
  }
  return (text ? JSON.parse(text) : null) as T;
}

/** Pulls the readable message out of an eBay error payload. */
export function ebayMessage(text: string): string {
  try {
    const body = JSON.parse(text);
    const errors = body.errors ?? body.warnings ?? [];
    if (Array.isArray(errors) && errors.length) {
      return errors.map((e: any) => e.longMessage || e.message).filter(Boolean).join('; ');
    }
  } catch { /* fall through */ }
  return text.slice(0, 400);
}

/** Validates the caller's JWT and returns their user, or throws. */
export async function requireUser(req: Request, supabase: Client) {
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) throw new Error('Missing Authorization header');
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) throw new Error('Invalid or expired session');
  return data.user;
}

export async function requireRole(supabase: Client, userId: string, roles: string[]) {
  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !data) throw new Error('Could not load your profile');
  const role = (data as { role: string }).role;
  if (!roles.includes(role)) throw new Error('You do not have permission to do that');
  return role;
}
