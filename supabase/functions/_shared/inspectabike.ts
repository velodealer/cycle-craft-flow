// Shared helpers for the InspectABike partner API.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

export const INSPECTABIKE_BASE_URL = 'https://gotuhdjrkxtwwcezgbjo.supabase.co/functions/v1';

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

export async function iabFetch(path: string, init: RequestInit = {}) {
  const key = Deno.env.get('INSPECTABIKE_API_KEY');
  if (!key) throw Object.assign(new Error('InspectABike API key is not configured'), { status: 500 });

  const res = await fetch(`${INSPECTABIKE_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      ...(init.headers || {}),
    },
  });

  const text = await res.text();
  let body: any = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = { raw: text }; }

  if (!res.ok) {
    const message =
      res.status === 401 ? 'InspectABike rejected the API key'
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

export function normaliseFault(fault: any, inspectionId: string, bikeId: string, event?: string) {
  const id = String(fault?.id ?? fault?.fault_id ?? '');
  let status = String(fault?.status ?? 'reported').toLowerCase();
  if (event === 'fault.repaired') status = 'repaired';
  return {
    inspection_id: inspectionId,
    bike_id: bikeId,
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
