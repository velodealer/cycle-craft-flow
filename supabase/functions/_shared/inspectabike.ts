// Shared helpers for the InspectABike partner API.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

export const INSPECTABIKE_BASE_URL =
  (Deno.env.get('INSPECTABIKE_BASE_URL') || 'https://api.inspectabike.com/functions/v1')
    .trim()
    .replace(/\/+$/, '');

export function serviceClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );
}

export async function requireUser(req: Request, supabase: ReturnType<typeof serviceClient>) {
  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) throw new Error('Missing Authorization header');
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) throw new Error('Invalid or expired session');
  return data.user;
}

export async function requireRole(
  req: Request,
  supabase: ReturnType<typeof serviceClient>,
  roles: string[],
) {
  const user = await requireUser(req, supabase);
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, name, role')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!profile || !roles.includes(profile.role)) {
    const err = new Error('Forbidden');
    (err as any).status = 403;
    throw err;
  }
  return { user, profile };
}

// ---------------------------------------------------------------------------
// Per-dealer OAuth connection
// ---------------------------------------------------------------------------

export const IAB_AUTHORIZE_URL =
  (Deno.env.get('INSPECTABIKE_AUTHORIZE_URL') || 'https://inspectabike.com/oauth/authorize').trim();

export const IAB_TOKEN_URL =
  (Deno.env.get('INSPECTABIKE_TOKEN_URL') || `${INSPECTABIKE_BASE_URL}/oauth-token`).trim();

export class ReconnectRequired extends Error {
  constructor(message = 'InspectABike needs to be reconnected in Settings') {
    super(message);
    this.name = 'ReconnectRequired';
    (this as any).status = 409;
  }
}

export class NotConnected extends Error {
  constructor(message = 'Connect InspectABike in Settings first') {
    super(message);
    this.name = 'NotConnected';
    (this as any).status = 409;
  }
}

export function functionsBase() {
  return (
    Deno.env.get('PUBLIC_FUNCTIONS_BASE_URL') || `${Deno.env.get('SUPABASE_URL')}/functions/v1`
  ).trim().replace(/\/+$/, '');
}

export function redirectUri() {
  return `${functionsBase()}/inspectabike-oauth`;
}

export function webhookUrl() {
  return `${functionsBase()}/inspectabike-webhook`;
}

export function clientCredentials() {
  const clientId = Deno.env.get('INSPECTABIKE_CLIENT_ID');
  const clientSecret = Deno.env.get('INSPECTABIKE_CLIENT_SECRET');
  if (!clientId || !clientSecret) {
    throw new Error('InspectABike app credentials are not configured yet');
  }
  return { clientId, clientSecret };
}

export interface IabConnection {
  id: string;
  business_id: string;
  access_token: string | null;
  refresh_token: string | null;
  access_token_expires_at: string | null;
  account_name: string | null;
  external_account_id: string | null;
  webhook_secret: string | null;
  status: string;
  last_error: string | null;
  connected_at: string | null;
}

export async function loadConnection(
  supabase: ReturnType<typeof serviceClient>,
  businessId: string | null | undefined,
): Promise<IabConnection | null> {
  if (!businessId) return null;
  const { data, error } = await supabase
    .from('inspectabike_connections')
    .select('*')
    .eq('business_id', businessId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as IabConnection) ?? null;
}

async function markNeedsReconnect(
  supabase: ReturnType<typeof serviceClient>,
  businessId: string,
  message: string,
) {
  await supabase
    .from('inspectabike_connections')
    .update({ status: 'needs_reconnect', last_error: message.slice(0, 500) })
    .eq('business_id', businessId);
}

/** Exchange an authorisation code (PKCE) for tokens. */
export async function exchangeCode(code: string, codeVerifier: string) {
  const { clientId, clientSecret } = clientCredentials();
  const res = await fetch(IAB_TOKEN_URL, {
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
  if (!res.ok) throw new Error(`InspectABike token exchange failed [${res.status}]: ${text.slice(0, 300)}`);
  return JSON.parse(text) as {
    access_token: string;
    refresh_token: string;
    expires_in?: number;
    account_name?: string;
    account_id?: string;
    webhook_secret?: string;
  };
}

/** A valid access token for the business, refreshing when it is close to expiry. */
export async function getAccessToken(
  supabase: ReturnType<typeof serviceClient>,
  businessId: string,
): Promise<string> {
  const row = await loadConnection(supabase, businessId);
  if (!row || !row.refresh_token) throw new NotConnected();
  if (row.status === 'needs_reconnect') throw new ReconnectRequired();

  const expiresAt = row.access_token_expires_at ? Date.parse(row.access_token_expires_at) : 0;
  if (row.access_token && expiresAt - Date.now() > 60_000) return row.access_token;

  const { clientId, clientSecret } = clientCredentials();
  const res = await fetch(IAB_TOKEN_URL, {
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
    throw new Error(`InspectABike token refresh failed [${res.status}]: ${text.slice(0, 200)}`);
  }

  const tokens = JSON.parse(text) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  };

  const { error } = await supabase
    .from('inspectabike_connections')
    .update({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token ?? row.refresh_token,
      access_token_expires_at: new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString(),
      status: 'connected',
      last_error: null,
    })
    .eq('business_id', businessId)
    .eq('refresh_token', row.refresh_token);
  if (error) console.error('Failed to store rotated InspectABike token:', error.message);

  return tokens.access_token;
}

export interface IabContext {
  supabase: ReturnType<typeof serviceClient>;
  businessId?: string | null;
}

/**
 * Call the InspectABike partner API.
 * Uses the business's own connected account when there is one, and falls back
 * to the shared platform API key for dealers who have not connected yet.
 */
export async function iabFetch(path: string, init: RequestInit = {}, ctx?: IabContext) {
  let authHeaders: Record<string, string> | null = null;

  if (ctx?.supabase && ctx.businessId) {
    const row = await loadConnection(ctx.supabase, ctx.businessId);
    if (row?.refresh_token) {
      if (row.status === 'needs_reconnect') throw new ReconnectRequired();
      authHeaders = { Authorization: `Bearer ${await getAccessToken(ctx.supabase, ctx.businessId)}` };
    }
  }

  if (!authHeaders) {
    const key = Deno.env.get('INSPECTABIKE_API_KEY');
    if (!key) throw new NotConnected();
    authHeaders = { 'x-api-key': key };
  }

  const call = async () =>
    await fetch(`${INSPECTABIKE_BASE_URL}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
        ...(init.headers || {}),
      },
    });

  let res = await call();

  // Bearer rejected: force a refresh and retry once.
  if (res.status === 401 && authHeaders.Authorization && ctx?.supabase && ctx.businessId) {
    await ctx.supabase
      .from('inspectabike_connections')
      .update({ access_token_expires_at: new Date(0).toISOString() })
      .eq('business_id', ctx.businessId);
    authHeaders = { Authorization: `Bearer ${await getAccessToken(ctx.supabase, ctx.businessId)}` };
    res = await call();
    if (res.status === 401) {
      await markNeedsReconnect(ctx.supabase, ctx.businessId, 'InspectABike rejected the connection (401)');
      throw new ReconnectRequired();
    }
  }

  const text = await res.text();
  let body: any = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = { raw: text }; }

  if (!res.ok) {
    const message =
      res.status === 401 ? 'InspectABike rejected the connection'
      : res.status === 404 ? 'Inspection not found in InspectABike'
      : res.status === 400 ? (body?.error || body?.message || 'InspectABike rejected the request')
      : (body?.error || body?.message || 'InspectABike request failed');
    throw Object.assign(new Error(message), { status: res.status, body });
  }
  return body;
}

/** Map a VeloDealer bike onto InspectABike's bike_type enum. */
export function mapBikeType(bike: any): 'standard' | 'carbon' | 'ebike' | 'mountain' {
  if (bike?.is_electric) return 'ebike';
  const material = String(bike?.frame_material || '').toLowerCase();
  if (material.includes('carbon')) return 'carbon';
  const type = String(bike?.bike_type || '').toLowerCase();
  if (type.includes('mountain') || type.includes('mtb') || type.includes('enduro') || type.includes('trail')) {
    return 'mountain';
  }
  return 'standard';
}

const OPEN_STATUSES = new Set(['reported', 'approved', 'awaiting_part']);

const VALID_FAULT_STATUSES = ['reported', 'approved', 'declined', 'awaiting_part', 'repaired'];

/**
 * Merge a local fault status with an incoming remote one.
 * Never downgrades a decision: approved/declined/awaiting_part/repaired survive
 * a remote 'reported'. A remote 'repaired' always wins.
 */
export function mergeFaultStatus(localStatus: string, incomingStatus: string): string {
  if (incomingStatus === 'repaired') return 'repaired';
  if (localStatus !== 'reported' && incomingStatus === 'reported') return localStatus;
  return VALID_FAULT_STATUSES.includes(incomingStatus) ? incomingStatus : localStatus;
}

export function normaliseFault(fault: any, inspectionId: string, bikeId: string, event?: string, businessId?: string | null) {
  const id = String(fault?.id ?? fault?.fault_id ?? '');
  let status = String(fault?.status ?? 'reported').toLowerCase();
  if (event === 'fault.repaired') status = 'repaired';
  return {
    inspection_id: inspectionId,
    bike_id: bikeId,
    business_id: businessId ?? null,
    external_fault_id: id,
    title: String(fault?.title ?? fault?.name ?? fault?.component ?? 'Fault'),
    description: fault?.description ?? fault?.notes ?? null,
    component: fault?.component ?? fault?.component_name ?? null,
    severity: fault?.severity ?? null,
    parts_cost: Number(fault?.parts_cost ?? 0) || 0,
    labour_cost: Number(fault?.labour_cost ?? 0) || 0,
    status: VALID_FAULT_STATUSES.includes(status) ? status : 'reported',
    raw: fault ?? {},
  };
}

export function isOpenFault(status: string) {
  return OPEN_STATUSES.has(status);
}

/** A fault still waiting on an approve/decline decision. */
export function needsDecision(status: string) {
  return status === 'reported';
}

/**
 * Upsert fault rows keyed by external_fault_id, merging statuses so local
 * decisions are never reset by remote updates. Repairs set repaired_at and
 * complete the linked workshop job.
 */
export async function upsertFaults(
  supabase: ReturnType<typeof serviceClient>,
  rows: Array<Record<string, any>>,
) {
  if (!rows.length) return;
  const ids = rows.map((r) => r.external_fault_id).filter(Boolean);
  const { data: existing } = await supabase
    .from('inspection_faults')
    .select('id, external_fault_id, status, job_id, repaired_at')
    .in('external_fault_id', ids);
  const byExternal = new Map((existing || []).map((e: any) => [e.external_fault_id, e]));

  const now = new Date().toISOString();
  const merged = rows.map((row) => {
    const local: any = byExternal.get(row.external_fault_id);
    const status = local ? mergeFaultStatus(local.status, row.status) : row.status;
    return {
      ...row,
      status,
      // Every row must carry an id: PostgREST unifies columns across a batch,
      // so a missing id on one row is sent as an explicit NULL for all of them.
      id: local?.id ?? crypto.randomUUID(),
      repaired_at: status === 'repaired' ? (local?.repaired_at ?? now) : (local?.repaired_at ?? null),
    };
  });

  const { error } = await supabase
    .from('inspection_faults')
    .upsert(merged, { onConflict: 'external_fault_id' });
  if (error) throw new Error(error.message);

  // Complete linked jobs for faults that just became repaired.
  for (const row of merged) {
    const local: any = byExternal.get(row.external_fault_id);
    if (row.status === 'repaired' && local?.job_id && local.status !== 'repaired') {
      await supabase
        .from('jobs')
        .update({ status: 'completed', completed_at: now })
        .eq('id', local.job_id)
        .neq('status', 'completed');
    }
  }
}

/**
 * Recalculate the bike's workflow status from its faults.
 * Any open fault keeps it in pending_approval; all repaired/declined releases it to ready.
 */
export async function syncBikeStatusFromFaults(
  supabase: ReturnType<typeof serviceClient>,
  bikeId: string,
  inspectionCompleted: boolean,
) {
  const { data: bike } = await supabase
    .from('bikes')
    .select('id, status')
    .eq('id', bikeId)
    .maybeSingle();
  if (!bike) return;
  // Never override later lifecycle stages.
  if (!['inspection', 'pending_approval', 'repair', 'ready'].includes(bike.status)) return;

  const { data: faults } = await supabase
    .from('inspection_faults')
    .select('status')
    .eq('bike_id', bikeId);

  const list = faults || [];
  const undecided = list.some((f: any) => needsDecision(f.status));
  const inProgress = list.some((f: any) => f.status === 'approved' || f.status === 'awaiting_part');

  let next: string | null = null;
  if (undecided) next = 'pending_approval';
  else if (inProgress) next = 'repair';
  else if (inspectionCompleted) next = 'ready';

  if (next && next !== bike.status) {
    await supabase.from('bikes').update({ status: next }).eq('id', bikeId);
  }
}

/**
 * Rewrite the origin of an InspectABike report URL using the base URL saved in
 * the integrations row (settings.report_base_url). InspectABike's API returns
 * links on its own preview domain; this swaps in their real public domain.
 * Returns the URL unchanged when no base is configured or either URL is invalid.
 */
export function rewriteReportUrl(url: string | null | undefined, base: string | null | undefined): string | null {
  if (!url) return null;
  if (!base) return url;
  try {
    const b = new URL(base.trim());
    if (b.protocol !== 'http:' && b.protocol !== 'https:') return url;
    const u = new URL(url);
    u.protocol = b.protocol;
    u.host = b.host;
    return u.toString();
  } catch {
    return url;
  }
}

/** Read the configured report-link base URL for InspectABike, or null. */
export async function getReportBaseUrl(supabase: ReturnType<typeof serviceClient>): Promise<string | null> {
  const { data } = await supabase
    .from('integrations')
    .select('settings')
    .eq('name', 'inspectabike')
    .maybeSingle();
  const base = (data?.settings as Record<string, unknown> | null)?.report_base_url;
  return typeof base === 'string' && base.trim() ? base.trim() : null;
}
