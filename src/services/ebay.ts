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

export type PolicyKind = 'fulfillment' | 'payment' | 'returns';

export interface EbayPolicyBase {
  id: string;
  name: string;
  description: string;
}

export interface FulfillmentPolicy extends EbayPolicyBase {
  handling_time_days: number;
  shipping_service_code: string;
  free_shipping: boolean;
  shipping_cost: number;
  local_pickup: boolean;
}

export interface PaymentPolicy extends EbayPolicyBase {
  immediate_pay: boolean;
}

export interface ReturnsPolicy extends EbayPolicyBase {
  returns_accepted: boolean;
  return_period_days: number;
  return_shipping_cost_payer: 'BUYER' | 'SELLER';
  refund_method: 'MONEY_BACK' | 'MONEY_BACK_OR_REPLACEMENT';
}

export type AnyPolicy = FulfillmentPolicy | PaymentPolicy | ReturnsPolicy;

export interface EbayPolicies {
  fulfillment: FulfillmentPolicy[];
  payment: PaymentPolicy[];
  returns: ReturnsPolicy[];
}

export interface ShippingService { code: string; name: string }

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

export const getEbayPolicies = () => invoke<EbayPolicies>('ebay-oauth', { action: 'policies' });

export const getEbayShippingServices = () =>
  invoke<{ services: ShippingService[] }>('ebay-oauth', { action: 'shipping_services' });

/** Creates a policy on eBay, or updates it when policy_id is supplied. */
export const saveEbayPolicy = (kind: PolicyKind, values: Record<string, unknown>, policyId?: string | null) =>
  invoke<{ ok: true; policy: AnyPolicy }>('ebay-oauth', {
    action: 'save_policy',
    kind,
    policy_id: policyId ?? null,
    ...values,
  });

export const deleteEbayPolicy = (kind: PolicyKind, policyId: string) =>
  invoke<{ ok: true }>('ebay-oauth', { action: 'delete_policy', kind, policy_id: policyId });

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
