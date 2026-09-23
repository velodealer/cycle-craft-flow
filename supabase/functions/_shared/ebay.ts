// Shared eBay helpers for edge functions.
import { createClient } from 'npm:@supabase/supabase-js@2';

export const EBAY_INTEGRATION_NAME = 'ebay';

export const EBAY_SCOPES = [
  'https://api.ebay.com/oauth/api_scope',
  'https://api.ebay.com/oauth/api_scope/sell.inventory',
  'https://api.ebay.com/oauth/api_scope/sell.account',
  'https://api.ebay.com/oauth/api_scope/sell.fulfillment',
  'https://api.ebay.com/oauth/api_scope/commerce.identity.readonly',
].join(' ');

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

function basicAuth() {
  const id = Deno.env.get('EBAY_CLIENT_ID');
  const secret = Deno.env.get('EBAY_CLIENT_SECRET');
  if (!id || !secret) throw new Error('EBAY_CLIENT_ID / EBAY_CLIENT_SECRET are not configured');
  return btoa(`${id}:${secret}`);
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

export async function loadSettings(supabase: Client, businessId: string): Promise<EbaySettings> {
  const row = await loadIntegration(supabase, businessId);
  return ((row?.settings ?? {}) as EbaySettings) || {};
}

export async function saveSettings(
  supabase: Client,
  businessId: string,
  settings: EbaySettings,
  isActive = true,
): Promise<EbaySettings> {
  const existing = await loadIntegration(supabase, businessId);
  const merged = { ...((existing?.settings as EbaySettings) ?? {}), ...settings };
  if (existing) {
    const { error } = await supabase
      .from('integrations')
      .update({ settings: merged, is_active: isActive, updated_at: new Date().toISOString() })
      .eq('id', (existing as { id: string }).id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from('integrations').insert({
      name: EBAY_INTEGRATION_NAME,
      display_name: 'eBay',
      is_active: isActive,
      business_id: businessId,
      settings: merged,
    });
    if (error) throw new Error(error.message);
  }
  return merged;
}

/** Swaps an authorisation code for refresh + access tokens. */
export async function exchangeCode(env: EbayEnvironment, code: string) {
  const ruName = Deno.env.get('EBAY_RU_NAME');
  if (!ruName) throw new Error('EBAY_RU_NAME is not configured');
  const res = await fetch(`${apiBase(env)}/identity/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basicAuth()}`,
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
      Authorization: `Basic ${basicAuth()}`,
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
export async function requireConnection(supabase: Client, businessId: string): Promise<Connection> {
  const settings = await loadSettings(supabase, businessId);
  const env: EbayEnvironment = settings.environment === 'production' ? 'production' : 'sandbox';
  if (!settings.refresh_token) {
    throw new Error('eBay is not connected — connect your seller account in Settings → Integrations.');
  }

  const expires = settings.access_token_expires_at ? Date.parse(settings.access_token_expires_at) : 0;
  if (settings.access_token && expires - 60_000 > Date.now()) {
    return { environment: env, accessToken: settings.access_token, settings };
  }

  const fresh = await refreshAccessToken(env, settings.refresh_token);
  const merged = await saveSettings(supabase, businessId, {
    access_token: fresh.access_token,
    access_token_expires_at: new Date(Date.now() + fresh.expires_in * 1000).toISOString(),
  });
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
