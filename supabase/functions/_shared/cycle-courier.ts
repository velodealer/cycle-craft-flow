// Shared Cycle Courier Co OAuth helpers for edge functions.
import { createClient } from 'npm:@supabase/supabase-js@2';

export const CC_AUTHORIZE_URL = 'https://booking.cyclecourierco.com/oauth/authorize';
export const CC_API_BASE = 'https://api.cyclecourierco.com/functions/v1';

export type Client = ReturnType<typeof serviceClient>;

export class ReconnectRequired extends Error {
  constructor(message = 'Cycle Courier needs to be reconnected in Settings') {
    super(message);
    this.name = 'ReconnectRequired';
  }
}

export class NotConnected extends Error {
  constructor(message = 'Connect Cycle Courier in Settings before booking') {
    super(message);
    this.name = 'NotConnected';
  }
}

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
  return `${functionsBase()}/cycle-courier-oauth`;
}

export function clientCredentials() {
  const clientId = Deno.env.get('CYCLE_COURIER_CLIENT_ID');
  const clientSecret = Deno.env.get('CYCLE_COURIER_CLIENT_SECRET');
  if (!clientId || !clientSecret) {
    throw new Error('Cycle Courier app credentials are not configured yet');
  }
  return { clientId, clientSecret };
}

export interface ConnectionRow {
  id: string;
  business_id: string;
  access_token: string | null;
  refresh_token: string | null;
  access_token_expires_at: string | null;
  account_name: string | null;
  status: string;
  last_error: string | null;
  connected_at: string | null;
}

export async function loadConnection(
  supabase: Client,
  businessId: string,
): Promise<ConnectionRow | null> {
  const { data, error } = await supabase
    .from('cycle_courier_connections')
    .select('*')
    .eq('business_id', businessId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as ConnectionRow) ?? null;
}

async function markNeedsReconnect(supabase: Client, businessId: string, message: string) {
  await supabase
    .from('cycle_courier_connections')
    .update({ status: 'needs_reconnect', last_error: message.slice(0, 500) })
    .eq('business_id', businessId);
}

/** Exchanges an authorisation code (PKCE) for tokens. */
export async function exchangeCode(code: string, codeVerifier: string) {
  const { clientId, clientSecret } = clientCredentials();
  const res = await fetch(`${CC_API_BASE}/oauth-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri(),
      code_verifier: codeVerifier,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Cycle Courier token exchange failed [${res.status}]: ${text}`);
  return JSON.parse(text) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    scope?: string;
    account_name?: string;
  };
}

export async function revokeToken(token: string) {
  try {
    const { clientId, clientSecret } = clientCredentials();
    await fetch(`${CC_API_BASE}/oauth-revoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token, client_id: clientId, client_secret: clientSecret }),
    });
  } catch (e) {
    console.error('Cycle Courier revoke failed:', (e as Error).message);
  }
}

/**
 * Returns a valid access token for the business, refreshing when needed.
 * The rotated refresh token is persisted immediately; the update is conditional
 * on the refresh token we started from, so parallel bookings cannot double-refresh.
 */
export async function getAccessToken(supabase: Client, businessId: string): Promise<string> {
  const row = await loadConnection(supabase, businessId);
  if (!row || !row.refresh_token) throw new NotConnected();
  if (row.status === 'needs_reconnect') throw new ReconnectRequired();

  const expiresAt = row.access_token_expires_at ? Date.parse(row.access_token_expires_at) : 0;
  if (row.access_token && expiresAt - Date.now() > 60_000) return row.access_token;

  const { clientId, clientSecret } = clientCredentials();
  const res = await fetch(`${CC_API_BASE}/oauth-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: row.refresh_token,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  const text = await res.text();

  if (!res.ok) {
    if (text.includes('invalid_grant') || res.status === 400 || res.status === 401) {
      // Another request may already have rotated the token — re-read once.
      const fresh = await loadConnection(supabase, businessId);
      if (
        fresh?.access_token &&
        fresh.refresh_token !== row.refresh_token &&
        (fresh.access_token_expires_at ? Date.parse(fresh.access_token_expires_at) : 0) - Date.now() > 10_000
      ) {
        return fresh.access_token;
      }
      await markNeedsReconnect(supabase, businessId, `Refresh failed: ${text.slice(0, 200)}`);
      throw new ReconnectRequired();
    }
    throw new Error(`Cycle Courier token refresh failed [${res.status}]: ${text}`);
  }

  const tokens = JSON.parse(text) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  const { error } = await supabase
    .from('cycle_courier_connections')
    .update({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      access_token_expires_at: new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString(),
      status: 'connected',
      last_error: null,
    })
    .eq('business_id', businessId)
    .eq('refresh_token', row.refresh_token);
  if (error) console.error('Failed to store rotated Cycle Courier token:', error.message);

  return tokens.access_token;
}

/** Calls the Cycle Courier API on behalf of a business. */
export async function cycleCourierFetch(
  supabase: Client,
  businessId: string,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const call = async (token: string) =>
    await fetch(`${CC_API_BASE}${path}`, {
      ...init,
      headers: {
        ...(init.headers ?? {}),
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

  let res = await call(await getAccessToken(supabase, businessId));
  if (res.status === 401) {
    // Force a refresh and retry once.
    await supabase
      .from('cycle_courier_connections')
      .update({ access_token_expires_at: new Date(0).toISOString() })
      .eq('business_id', businessId);
    try {
      res = await call(await getAccessToken(supabase, businessId));
    } catch (e) {
      throw e;
    }
    if (res.status === 401) {
      await markNeedsReconnect(supabase, businessId, 'Cycle Courier rejected the connection (401)');
      throw new ReconnectRequired();
    }
  }
  return res;
}

export async function requireUser(req: Request, supabase: Client) {
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) throw new Error('Missing Authorization header');
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) throw new Error('Invalid or expired session');
  return data.user;
}

export async function requireProfile(supabase: Client, userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('role, business_id')
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !data) throw new Error('Profile not found');
  return data as { role: string; business_id: string };
}
