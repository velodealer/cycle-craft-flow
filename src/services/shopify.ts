import { supabase } from '@/integrations/supabase/client';
import { FunctionsHttpError } from '@supabase/supabase-js';

export interface ShopifyStatus {
  connected: boolean;
  shop_domain: string | null;
  shop_name: string | null;
  connected_at: string | null;
  auto_list: boolean;
  product_type: string;
  vendor: string;
  location_id: string | null;
  callback_url: string;
}

export interface ShopifyListing {
  bike_id: string;
  product_id: string | null;
  product_url: string | null;
  status: string;
  quantity: number;
  last_synced_at: string | null;
  last_error: string | null;
}

async function invoke<T>(fn: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(fn, { body });
  if (error) {
    const details = error instanceof FunctionsHttpError ? await error.context.text() : error.message;
    let message = details;
    try {
      message = JSON.parse(details).error || details;
    } catch { /* keep raw text */ }
    throw new Error(message);
  }
  return data as T;
}

export const getShopifyStatus = () => invoke<ShopifyStatus>('shopify-oauth', { action: 'status' });

export const getShopifyAuthUrl = () =>
  invoke<{ url: string }>('shopify-oauth', { action: 'auth_url' });

export const disconnectShopify = () => invoke<{ ok: true }>('shopify-oauth', { action: 'disconnect' });

export const listShopifyLocations = () =>
  invoke<{ locations: { id: string; name: string }[] }>('shopify-oauth', { action: 'locations' });

export const saveShopifySettings = (settings: {
  auto_list: boolean;
  product_type: string;
  vendor: string;
  location_id?: string | null;
}) => invoke<{ ok: true }>('shopify-oauth', { action: 'save_settings', ...settings });

export const listBikeOnShopify = (bikeId: string) =>
  invoke<{ ok: true; product_id: string; url: string | null }>('shopify-sync-bike', {
    bike_id: bikeId,
    action: 'list',
  });

export const removeBikeFromShopify = (bikeId: string) =>
  invoke<{ ok: true; removed: boolean }>('shopify-sync-bike', { bike_id: bikeId, action: 'unlist' });

export const markBikeSoldOutOnShopify = (bikeId: string) =>
  invoke<{ ok: true; updated: boolean }>('shopify-sync-bike', { bike_id: bikeId, action: 'sold_out' });

export async function getBikeListing(bikeId: string): Promise<ShopifyListing | null> {
  const { data, error } = await supabase
    .from('shopify_listings')
    .select('bike_id, product_id, product_url, status, quantity, last_synced_at, last_error')
    .eq('bike_id', bikeId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as ShopifyListing) ?? null;
}

/** Fire-and-forget sync used by status changes — never blocks or throws. */
export async function syncShopifyQuietly(bikeId: string, action: 'list' | 'sold_out' | 'unlist') {
  try {
    if (action === 'list' && AUTO_LIST_PAUSED) return; // see AUTO_LIST_PAUSED in services/ebay.ts
    const status = await getShopifyStatus();
    if (!status.connected) return;
    if (action === 'list' && !status.auto_list) return;
    if (action !== 'list') {
      const listing = await getBikeListing(bikeId);
      if (!listing?.product_id) return;
    }
    await invoke('shopify-sync-bike', { bike_id: bikeId, action });
  } catch (e) {
    console.error('Shopify sync skipped:', (e as Error).message);
  }
}
