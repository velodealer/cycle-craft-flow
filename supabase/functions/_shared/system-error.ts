// Records a background-task error in system_error_logs so the super admin sees it at /admin/errors.
// Never throws: logging must not break the caller.
// deno-lint-ignore no-explicit-any
type Client = any;

export interface SystemErrorEntry {
  source: string; // e.g. 'ebay', 'quickbooks', 'xero'
  message: string;
  businessId?: string | null;
  entityRef?: string | null; // bike reference / invoice number, used to find the dealership when not given
  detail?: Record<string, unknown> | null;
}

async function resolveBusiness(supabase: Client, ref: string): Promise<string | null> {
  for (const [table, col] of [['bikes', 'reference'], ['invoices', 'invoice_number']] as const) {
    const { data } = await supabase.from(table).select('business_id').eq(col, ref).limit(1).maybeSingle();
    if (data?.business_id) return data.business_id;
  }
  return null;
}

export async function logSystemError(supabase: Client, e: SystemErrorEntry) {
  try {
    let businessId = e.businessId ?? null;
    if (!businessId && e.entityRef) {
      // Refs like STK-IN-BPS-GIA-9691 wrap a bike reference.
      const ref = e.entityRef.replace(/^STK-(IN|OUT)-/, '');
      businessId = await resolveBusiness(supabase, ref).catch(() => null);
    }
    await supabase.from('system_error_logs').insert({
      source: e.source,
      severity: 'error',
      message: String(e.message || 'Unknown error').slice(0, 2000),
      business_id: businessId,
      detail: { ...(e.detail ?? {}), ...(e.entityRef ? { entity: e.entityRef } : {}) },
      url: null,
    });
  } catch (err) {
    console.error('Failed to write system error log:', (err as Error).message);
  }
}
