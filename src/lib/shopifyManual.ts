import { supabase } from '@/integrations/supabase/client';
import { logActivity } from '@/lib/activity';

export interface ShopifyManualState {
  shopify_manual_listed_at?: string | null;
  shopify_manual_stale?: boolean | null;
  shopify_delist_required_at?: string | null;
}

export type ShopifyManualStatus = 'not_listed' | 'listed' | 'changed' | 'remove';

export function shopifyManualStatus(b: ShopifyManualState): ShopifyManualStatus {
  if (b.shopify_delist_required_at) return 'remove';
  if (!b.shopify_manual_listed_at) return 'not_listed';
  return b.shopify_manual_stale ? 'changed' : 'listed';
}

/** Never ticked, or changed since it was ticked. */
export const needsShopifyExport = (b: ShopifyManualState) => {
  const s = shopifyManualStatus(b);
  return s === 'not_listed' || s === 'changed';
};

export const SHOPIFY_MANUAL_FIELDS = 'shopify_manual_listed_at, shopify_manual_stale, shopify_delist_required_at';

export async function markShopifyListed(bikeIds: string[]) {
  if (!bikeIds.length) return;
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from('bikes').update({
    shopify_manual_listed_at: new Date().toISOString(),
    shopify_manual_listed_by: user?.id ?? null,
    shopify_manual_stale: false,
    shopify_delist_required_at: null,
  } as any).in('id', bikeIds);
  if (error) throw error;
  bikeIds.forEach((id) => logActivity(id, { kind: 'listing', action: 'shopify_manual_listed', summary: 'Ticked as listed on Shopify' } as any));
}

export async function unmarkShopifyListed(bikeId: string) {
  const { error } = await supabase.from('bikes').update({
    shopify_manual_listed_at: null, shopify_manual_listed_by: null, shopify_manual_stale: false,
  } as any).eq('id', bikeId);
  if (error) throw error;
  logActivity(bikeId, { kind: 'listing', action: 'shopify_manual_unlisted', summary: 'Unticked as listed on Shopify' } as any);
}

export async function markShopifyRemoved(bikeId: string) {
  const { error } = await supabase.from('bikes').update({
    shopify_manual_listed_at: null, shopify_manual_listed_by: null, shopify_manual_stale: false, shopify_delist_required_at: null,
  } as any).eq('id', bikeId);
  if (error) throw error;
  logActivity(bikeId, { kind: 'listing', action: 'shopify_manual_removed', summary: 'Removed from Shopify' } as any);
}
