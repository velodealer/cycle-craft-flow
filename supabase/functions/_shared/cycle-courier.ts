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

/* ------------------------------------------------------------------ */
/* Shared status + tracking normalisation                              */
/* ------------------------------------------------------------------ */

const STATUS_ALIASES: Record<string, string> = {
  completed: 'delivered',
  complete: 'delivered',
  delivery_completed: 'delivered',
  delivered_to_customer: 'delivered',
  courier_delivered: 'delivered',
  order_delivered: 'delivered',
  picked_up: 'collected',
  pickup_completed: 'collected',
  collection_completed: 'collected',
  driver_to_pickup: 'driver_to_collection',
  intransit: 'in_transit',
  in_transit: 'driver_to_delivery',
  out_for_delivery: 'driver_to_delivery',
  canceled: 'cancelled',
  cancelled_by_customer: 'cancelled',
};

/** Maps any Cycle Courier status string onto our internal vocabulary. */
export function normaliseCourierStatus(value: unknown): string {
  const raw = String(value ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (!raw) return '';
  return STATUS_ALIASES[raw] || raw;
}

/** Pulls a status out of any of the shapes the courier API/webhook uses. */
export function extractCourierStatus(order: any): string {
  const candidates = [
    order?.status,
    typeof order?.status === 'object' ? order?.status?.current ?? order?.status?.value ?? order?.status?.name : null,
    order?.currentStatus,
    order?.current_status,
    order?.deliveryStatus,
    order?.delivery_status,
    order?.orderStatus,
    order?.order_status,
  ];
  for (const candidate of candidates) {
    const status = normaliseCourierStatus(candidate);
    if (status) return status;
  }
  const history = order?.statusHistory ?? order?.status_history;
  if (Array.isArray(history) && history.length) {
    const last = history[history.length - 1];
    return normaliseCourierStatus(last?.status ?? last?.name ?? last);
  }
  return '';
}

/** Pulls the customer-facing CCC tracking number out of any response shape. */
export function extractTrackingNumber(order: any): string | null {
  const candidates = [
    order?.trackingNumber,
    order?.tracking_number,
    order?.tracking?.number,
    order?.tracking?.trackingNumber,
    order?.shipment?.trackingNumber,
    order?.shipment?.tracking_number,
    order?.cccNumber,
    order?.ccc_number,
    order?.consignmentNumber,
    order?.consignment_number,
    order?.reference,
    order?.orderReference,
    order?.order_reference,
  ];
  for (const candidate of candidates) {
    const value = typeof candidate === 'string' ? candidate.trim() : candidate ? String(candidate).trim() : '';
    if (value && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) return value;
  }
  return null;
}

const STATUS_RANK: Record<string, number> = {
  created: 1,
  pending: 1,
  scheduled: 2,
  driver_to_collection: 3,
  collection_in_progress: 3,
  collected: 4,
  driver_to_delivery: 5,
  in_transit: 5,
  delivered: 9,
  failed: 8,
  cancelled: 8,
};

/**
 * True when `next` should replace `current`.
 * Delivered is terminal; a delivered update always wins over cancelled/failed.
 */
export function shouldApplyStatus(current: string | null | undefined, next: string): boolean {
  if (!next) return false;
  const from = String(current || '');
  if (from === next) return false;
  if (from === 'delivered') return false;
  if (next === 'delivered') return true;
  if ((from === 'cancelled' || from === 'failed') && next !== 'cancelled' && next !== 'failed') return false;
  return (STATUS_RANK[next] ?? 0) >= (STATUS_RANK[from] ?? 0) || next === 'cancelled' || next === 'failed';
}

/* ------------------------------------------------------------------ */
/* Dealer-side (customer_side) helpers                                 */
/* ------------------------------------------------------------------ */

/**
 * Cycle Courier fills the dealer's own side of the job from the address saved
 * against our app on their account. This is the reply when no address is set.
 */
export const MISSING_SHOP_ADDRESS_MESSAGE =
  'Add your shop address to your Cycle Courier account, then book again.';

/** Turns a failed Cycle Courier response body into a message we can show. */
export function friendlyCourierError(status: number, body: string): string {
  if (status === 400 && body.includes('CUSTOMER_ADDRESS_MISSING')) {
    return MISSING_SHOP_ADDRESS_MESSAGE;
  }
  return `API error: ${status} - ${body}`;
}

export interface CourierParty {
  name: string | null;
  email: string | null;
  phone: string | null;
  street: string | null;
  city: string | null;
  postcode: string | null;
  country: string | null;
}

/** Reads back a side of a created order (the dealer side is filled in by CCC). */
export function extractParty(order: any, side: 'sender' | 'receiver'): CourierParty {
  const party = order?.[side] ?? order?.[`${side}Details`] ?? {};
  const address = party?.address ?? party ?? {};
  const str = (v: unknown) => {
    const s = typeof v === 'string' ? v.trim() : v == null ? '' : String(v);
    return s ? s : null;
  };
  return {
    name: str(party?.name),
    email: str(party?.email),
    phone: str(party?.phone),
    street: str(address?.street),
    city: str(address?.city),
    postcode: str(address?.zipCode ?? address?.postcode ?? address?.zipcode),
    country: str(address?.country),
  };
}
