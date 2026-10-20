import { supabase } from '@/integrations/supabase/client';
import { syncShopifyQuietly } from '@/services/shopify';
import { syncSquarespaceQuietly } from '@/services/squarespace';
import { syncEbayQuietly } from '@/services/ebay';

/** A sold bike stays on sale until its invoice has a deposit or full payment. */
export const isSaleSecured = (inv: { deposit_received_at?: string | null; paid_at?: string | null; status?: string | null }) =>
  !!inv.deposit_received_at || !!inv.paid_at || inv.status === 'paid';

function takeBikeOffSale(bikeId: string) {
  void syncShopifyQuietly(bikeId, 'sold_out');
  void syncSquarespaceQuietly(bikeId, 'sold_out');
  void syncEbayQuietly(bikeId, 'end');
}

/** Records a deposit or full payment and takes the bike off every channel. */
export async function markInvoicePayment(
  invoice: { id: string; bike_id: string | null },
  kind: 'deposit' | 'paid',
  depositAmount?: number,
) {
  const now = new Date().toISOString();
  const patch = kind === 'deposit'
    ? { deposit_received_at: now, deposit_amount: depositAmount ?? null }
    : { paid_at: now, status: 'paid' as const };
  const { error } = await supabase.from('invoices').update(patch as any).eq('id', invoice.id);
  if (error) throw error;
  if (invoice.bike_id) {
    // Only now does the bike become Sold (unless it already moved on).
    const { error: bErr } = await supabase.from('bikes')
      .update({ status: 'sold', sold_at: now })
      .eq('id', invoice.bike_id)
      .not('status', 'in', '(sold,collected,delivered,split_for_parts)');
    if (bErr) throw bErr;
    takeBikeOffSale(invoice.bike_id);
  }
}
