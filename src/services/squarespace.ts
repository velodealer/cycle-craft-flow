import { supabase } from '@/integrations/supabase/client';
import { FunctionsHttpError } from '@supabase/supabase-js';

export interface SquarespaceStatus {
  connected: boolean;
  website_title: string | null;
  website_url: string | null;
  store_page_id: string | null;
  store_page_title: string | null;
  live_sales: boolean;
  connected_at: string | null;
  callback_url: string;
}

export interface SquarespaceListing {
  bike_id: string;
  product_id: string | null;
  variant_id: string | null;
  url: string | null;
  status: string;
  last_synced_at: string | null;
  last_error: string | null;
}

async function invoke<T>(fn: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(fn, { body });
  if (error) {
    const details = error instanceof FunctionsHttpError ? await error.context.text() : error.message;
    let message = details;
    try { message = JSON.parse(details).error || details; } catch { /* raw */ }
    throw new Error(message);
  }
  return data as T;
}

export const getSquarespaceStatus = () => invoke<SquarespaceStatus>('squarespace-oauth', { action: 'status' });
export const getSquarespaceAuthUrl = () =>
  invoke<{ url: string }>('squarespace-oauth', { action: 'auth_url', origin: window.location.origin });
export const disconnectSquarespace = () => invoke<{ ok: true }>('squarespace-oauth', { action: 'disconnect' });
export const listSquarespaceStorePages = () =>
  invoke<{ pages: { id: string; title: string; enabled: boolean }[] }>('squarespace-oauth', { action: 'store_pages' });
export const setSquarespaceStorePage = (id: string, title: string) =>
  invoke<{ ok: true }>('squarespace-oauth', { action: 'set_store_page', store_page_id: id, store_page_title: title });
export const setupSquarespaceSales = () => invoke<{ ok: true }>('squarespace-oauth', { action: 'setup_webhook' });

export const listBikeOnSquarespace = (bikeId: string) =>
  invoke<{ ok: true; product_id: string; url: string | null }>('squarespace-sync-bike', { bike_id: bikeId, action: 'list' });
export const removeBikeFromSquarespace = (bikeId: string) =>
  invoke<{ ok: true; removed: boolean }>('squarespace-sync-bike', { bike_id: bikeId, action: 'unlist' });
export const markBikeSoldOutOnSquarespace = (bikeId: string) =>
  invoke<{ ok: true; updated: boolean }>('squarespace-sync-bike', { bike_id: bikeId, action: 'sold_out' });

export async function getBikeSquarespaceListing(bikeId: string): Promise<SquarespaceListing | null> {
  const { data } = await (supabase as any).from('squarespace_listings').select('*').eq('bike_id', bikeId).maybeSingle();
  return (data as SquarespaceListing) ?? null;
}

/** Fire-and-forget: only acts on bikes already on Squarespace. Never throws. */
export async function syncSquarespaceQuietly(bikeId: string, action: 'sold_out' | 'unlist') {
  try {
    const listing = await getBikeSquarespaceListing(bikeId);
    if (!listing?.product_id) return;
    await invoke('squarespace-sync-bike', { bike_id: bikeId, action });
  } catch (e) {
    console.error('Squarespace sync skipped:', (e as Error).message);
  }
}
