import { supabase } from '@/integrations/supabase/client';
import { FunctionsHttpError } from '@supabase/supabase-js';

export interface EbayStatus {
  connected: boolean;
  environment: 'sandbox' | 'production';
  seller_name: string | null;
  connected_at: string | null;
  auto_list: boolean;
  category_id: string;
  condition: string;
  postcode: string;
  fulfillment_policy_id: string;
  payment_policy_id: string;
  return_policy_id: string;
  callback_url: string;
}

export interface EbayListing {
  bike_id: string;
  condition: string | null;
  category_id: string | null;
  offer_id: string | null;
  listing_id: string | null;
  listing_url: string | null;
  status: string;
  quantity: number;
  last_synced_at: string | null;
  last_error: string | null;
}

export interface PolicyOption { id: string; name: string }

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

export const getEbayStatus = () => invoke<EbayStatus>('ebay-oauth', { action: 'status' });

export const getEbayAuthUrl = (environment: 'sandbox' | 'production') =>
  invoke<{ url: string }>('ebay-oauth', {
    action: 'auth_url',
    environment,
    origin: window.location.origin,
  });

export const disconnectEbay = () => invoke<{ ok: true }>('ebay-oauth', { action: 'disconnect' });

export const getEbayPolicies = () =>
  invoke<{ fulfillment: PolicyOption[]; payment: PolicyOption[]; returns: PolicyOption[] }>(
    'ebay-oauth',
    { action: 'policies' },
  );

export const searchEbayCategories = (query: string) =>
  invoke<{ categories: PolicyOption[] }>('ebay-oauth', { action: 'categories', query });

export const saveEbaySettings = (settings: {
  auto_list: boolean;
  category_id?: string;
  condition?: string;
  postcode?: string;
  fulfillment_policy_id?: string;
  payment_policy_id?: string;
  return_policy_id?: string;
}) => invoke<{ ok: true }>('ebay-oauth', { action: 'save_settings', ...settings });

export const listBikeOnEbay = (bikeId: string) =>
  invoke<{ ok: true; offer_id: string; listing_id: string | null; url: string | null }>(
    'ebay-sync-bike',
    { bike_id: bikeId, action: 'list' },
  );

export const endBikeOnEbay = (bikeId: string) =>
  invoke<{ ok: true; ended: boolean }>('ebay-sync-bike', { bike_id: bikeId, action: 'end' });

export const removeBikeFromEbay = (bikeId: string) =>
  invoke<{ ok: true; removed: boolean }>('ebay-sync-bike', { bike_id: bikeId, action: 'remove' });

export async function getBikeEbayListing(bikeId: string): Promise<EbayListing | null> {
  const { data, error } = await supabase
    .from('ebay_listings')
    .select('bike_id, condition, category_id, offer_id, listing_id, listing_url, status, quantity, last_synced_at, last_error')
    .eq('bike_id', bikeId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as EbayListing) ?? null;
}

/** Saves per-bike eBay options (condition and category). Blank means use the account default. */
export async function saveBikeEbayOptions(
  bikeId: string,
  options: { condition: string | null; category_id: string | null },
) {
  const { error } = await supabase
    .from('ebay_listings')
    .upsert(
      {
        bike_id: bikeId,
        condition: options.condition || null,
        category_id: options.category_id || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'bike_id' },
    );
  if (error) throw new Error(error.message);
}

/** Fire-and-forget sync used by status changes — never blocks or throws. */
export async function syncEbayQuietly(bikeId: string, action: 'list' | 'end' | 'remove') {
  try {
    const status = await getEbayStatus();
    if (!status.connected) return;
    if (action === 'list' && !status.auto_list) return;
    if (action !== 'list') {
      const listing = await getBikeEbayListing(bikeId);
      if (!listing?.offer_id) return;
    }
    await invoke('ebay-sync-bike', { bike_id: bikeId, action });
  } catch (e) {
    console.error('eBay sync skipped:', (e as Error).message);
  }
}
