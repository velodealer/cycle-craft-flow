// Dealership isolation guard for server functions that use elevated access.
// Every function that acts on a bike/invoice/part/etc. chosen by the caller must call
// assertTenantRow so a signed-in user can only ever touch their own dealership's rows.
// deno-lint-ignore-file no-explicit-any

export class TenantError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/** Resolves the caller's dealership from the bearer token. Returns null for trusted server-to-server calls. */
export async function callerBusiness(supabase: any, req: Request): Promise<{ businessId: string | null; superAdmin: boolean } | null> {
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) throw new TenantError('Missing Authorization header', 401);
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (serviceKey && token === serviceKey) return null;
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) throw new TenantError('Invalid or expired session', 401);
  const [{ data: profile }, { data: sa }] = await Promise.all([
    supabase.from('profiles').select('business_id').eq('user_id', data.user.id).maybeSingle(),
    supabase.from('super_admins').select('user_id').eq('user_id', data.user.id).maybeSingle(),
  ]);
  return { businessId: profile?.business_id ?? null, superAdmin: !!sa };
}

/** Pure decision used by the guard (and unit tests). */
export function rowAllowed(caller: { businessId: string | null; superAdmin: boolean } | null, rowBusinessId: string | null | undefined): boolean {
  if (caller === null) return true; // trusted server call
  if (caller.superAdmin) return true;
  return !!caller.businessId && !!rowBusinessId && caller.businessId === rowBusinessId;
}

/** Throws 404 unless the row exists and belongs to the caller's dealership. No-op for empty ids (callers validate those). */
export async function assertTenantRow(supabase: any, req: Request, table: string, id: string | null | undefined, column = 'id') {
  if (!id) return;
  const caller = await callerBusiness(supabase, req);
  const { data } = await supabase.from(table).select('business_id').eq(column, id).maybeSingle();
  if (!data || !rowAllowed(caller, data.business_id)) throw new TenantError('Not found', 404);
}
