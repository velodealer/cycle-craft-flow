import { supabase } from '@/integrations/supabase/client';
import { syncInvoice, syncBikePurchase, syncBreakToQuickBooks, tryPostFitPartToQuickBooks } from '@/lib/quickbooks';
import { trySyncXeroInvoice, tryPostXeroPurchase, tryPostBreakToXero, tryPostFitPartToXero } from '@/lib/xero';

export type SyncSystem = 'QuickBooks' | 'Xero';
export type SyncKind = 'invoice' | 'stock_in' | 'break' | 'fit_part';

export interface FailedSync {
  key: string;
  system: SyncSystem;
  kind: SyncKind;
  id: string;
  label: string;
  error: string | null;
  link: string;
}

const KIND_LABEL: Record<SyncKind, string> = {
  invoice: 'Invoice',
  stock_in: 'Stock in',
  break: 'Bike break',
  fit_part: 'Part fitted',
};
export const kindLabel = (k: SyncKind) => KIND_LABEL[k];

/** Everything this dealership tried to post to QuickBooks or Xero that failed. RLS keeps it to the caller's dealership. */
export async function listFailedSyncs(): Promise<FailedSync[]> {
  const [inv, bikes, parts] = await Promise.all([
    supabase
      .from('invoices')
      .select('id, invoice_number, sync_status, sync_error, xero_sync_status, xero_sync_error')
      .or('sync_status.eq.failed,xero_sync_status.eq.failed')
      .limit(200),
    supabase
      .from('bikes')
      .select('id, reference, make, model, purchase_sync_status, purchase_sync_error, xero_purchase_sync_status, xero_purchase_sync_error, break_qb_sync_status, break_qb_sync_error, break_xero_sync_status, break_xero_sync_error')
      .or('purchase_sync_status.eq.failed,xero_purchase_sync_status.eq.failed,break_qb_sync_status.eq.failed,break_xero_sync_status.eq.failed')
      .limit(200),
    supabase
      .from('parts')
      .select('id, description, brand, fit_qb_sync_status, fit_qb_sync_error, fit_xero_sync_status, fit_xero_sync_error')
      .or('fit_qb_sync_status.eq.failed,fit_xero_sync_status.eq.failed')
      .limit(200),
  ]);
  const err = inv.error || bikes.error || parts.error;
  if (err) throw new Error(err.message);

  const out: FailedSync[] = [];
  const push = (system: SyncSystem, kind: SyncKind, id: string, label: string, error: string | null, link: string) =>
    out.push({ key: `${system}:${kind}:${id}`, system, kind, id, label, error, link });

  for (const i of (inv.data ?? []) as any[]) {
    const label = i.invoice_number || 'Invoice';
    if (i.sync_status === 'failed') push('QuickBooks', 'invoice', i.id, label, i.sync_error, `/invoices/${i.id}`);
    if (i.xero_sync_status === 'failed') push('Xero', 'invoice', i.id, label, i.xero_sync_error, `/invoices/${i.id}`);
  }
  for (const b of (bikes.data ?? []) as any[]) {
    const label = [b.reference, b.make, b.model].filter(Boolean).join(' · ');
    const link = `/bikes/${b.id}`;
    if (b.purchase_sync_status === 'failed') push('QuickBooks', 'stock_in', b.id, label, b.purchase_sync_error, link);
    if (b.xero_purchase_sync_status === 'failed') push('Xero', 'stock_in', b.id, label, b.xero_purchase_sync_error, link);
    if (b.break_qb_sync_status === 'failed') push('QuickBooks', 'break', b.id, label, b.break_qb_sync_error, link);
    if (b.break_xero_sync_status === 'failed') push('Xero', 'break', b.id, label, b.break_xero_sync_error, link);
  }
  for (const p of (parts.data ?? []) as any[]) {
    if (p.fit_qb_sync_status === 'failed') push('QuickBooks', 'fit_part', p.id, ([p.brand, p.description].filter(Boolean).join(' ') || 'Part'), p.fit_qb_sync_error, '/parts');
    if (p.fit_xero_sync_status === 'failed') push('Xero', 'fit_part', p.id, ([p.brand, p.description].filter(Boolean).join(' ') || 'Part'), p.fit_xero_sync_error, '/parts');
  }
  return out;
}

/** Re-sends one failed posting. Returns an error message, or null when it went through. */
export async function retryFailedSync(s: FailedSync): Promise<string | null> {
  try {
    if (s.system === 'QuickBooks') {
      if (s.kind === 'invoice') await syncInvoice(s.id);
      else if (s.kind === 'stock_in') await syncBikePurchase(s.id);
      else if (s.kind === 'break') await syncBreakToQuickBooks(s.id);
      else {
        const r = await tryPostFitPartToQuickBooks(s.id);
        if (!r.ok) return r.error || 'Failed';
      }
      return null;
    }
    const r =
      s.kind === 'invoice' ? await trySyncXeroInvoice(s.id)
      : s.kind === 'stock_in' ? await tryPostXeroPurchase(s.id)
      : s.kind === 'break' ? await tryPostBreakToXero(s.id)
      : await tryPostFitPartToXero(s.id);
    return r.ok ? null : r.error || 'Failed';
  } catch (e) {
    return (e as Error).message;
  }
}
