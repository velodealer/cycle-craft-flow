import { supabase } from '@/integrations/supabase/client';
import { FunctionsHttpError } from '@supabase/supabase-js';

export interface EbayStatus {
  connected: boolean;
  environment: 'sandbox' | 'production';
  modes?: Record<'sandbox' | 'production', { connected: boolean; seller_name: string | null; connected_at: string | null }>;
  seller_name: string | null;
  connected_at: string | null;
  auto_list: boolean;
  category_id: string;
  condition: string;
  postcode: string;
  location_name: string;
  address_line1: string;
  city: string;
  country: string;
  business_name: string;
  fulfillment_policy_id: string;
  payment_policy_id: string;
  return_policy_id: string;
  callback_url: string;
  needs_reconnect?: boolean;
  refresh_token_expires_at?: string | null;
  category_by_type?: Record<string, string>;
  best_offer_enabled?: boolean;
  best_offer_accept_pct?: number | null;
  best_offer_decline_pct?: number | null;
  promote_enabled?: boolean;
  promote_auto?: boolean;
  ad_rate?: number;
  can_manage?: boolean;
}

export interface CheckItem { key: string; level: 'ok' | 'warn' | 'block'; label: string; detail?: string }

export interface EbayPreview {
  title: string;
  built_title: string;
  title_format: string | null;
  category_id: string;
  category_source: 'bike' | 'type' | 'default';
  condition: string | null;
  wanted_condition: string;
  aspects: Record<string, string[]>;
  specifics: {
    filled: number;
    total: number;
    missing_required: string[];
    missing_recommended: string[];
    unmapped: { name: string; value: string }[];
    choices?: Record<string, string[]>;
  };
  photos: { url: string; longest: number | null }[];
  mobile_preview: string;
  best_offer: { enabled: boolean };
  promotion: { enabled: boolean; rate: number | null; available: boolean };
  checklist: CheckItem[];
  can_publish: boolean;
}

export interface EbayOrder {
  id: string;
  order_id: string;
  bike_id: string | null;
  buyer_username: string | null;
  total: number | null;
  currency: string | null;
  status: string;
  carrier: string | null;
  tracking_number: string | null;
  despatched_at: string | null;
  created_at: string;
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
  condition_substituted_from: string | null;
  condition_substituted_to: string | null;
  title_override: string | null;
  best_offer_enabled: boolean | null;
  ad_rate: number | null;
  ad_id: string | null;
  gallery_photo_index: number | null;
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
  /** True when the seller has not switched business policies on in their eBay account. */
  opt_in_required?: boolean;
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

export const disconnectEbay = (environment?: 'sandbox' | 'production') =>
  invoke<{ ok: true }>('ebay-oauth', { action: 'disconnect', environment });

export const switchEbayMode = (environment: 'sandbox' | 'production') =>
  invoke<{ ok: true; environment: 'sandbox' | 'production'; connected: boolean }>('ebay-oauth', { action: 'switch_mode', environment });

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
  location_name?: string;
  address_line1?: string;
  city?: string;
  country?: string;
  fulfillment_policy_id?: string;
  payment_policy_id?: string;
  return_policy_id?: string;
}) => invoke<{ ok: true; location_error: string | null }>('ebay-oauth', { action: 'save_settings', ...settings });

export const getEbayHeldLocation = () =>
  invoke<{ held: { city: string | null; postcode: string | null } | null }>('ebay-oauth', { action: 'location' });

export const listBikeOnEbay = (bikeId: string) =>
  invoke<{ ok: true; offer_id: string; listing_id: string | null; url: string | null; warnings?: string[] }>(
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
    .select('bike_id, condition, category_id, offer_id, listing_id, listing_url, status, quantity, last_synced_at, last_error, condition_substituted_from, condition_substituted_to, title_override, best_offer_enabled, ad_rate, ad_id, gallery_photo_index')
    .eq('bike_id', bikeId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as EbayListing) ?? null;
}

/** Saves per-bike eBay options (condition and category). Blank means use the account default. */
export async function saveBikeEbayOptions(
  bikeId: string,
  options: {
    condition: string | null;
    category_id: string | null;
    title_override?: string | null;
    best_offer_enabled?: boolean | null;
    gallery_photo_index?: number | null;
    ad_rate?: number | null;
  },
) {
  const row: Record<string, unknown> = {
    bike_id: bikeId,
    condition: options.condition || null,
    category_id: options.category_id || null,
    updated_at: new Date().toISOString(),
  };
  for (const k of ['title_override', 'best_offer_enabled', 'gallery_photo_index', 'ad_rate'] as const) {
    if (options[k] !== undefined) row[k] = options[k] === '' ? null : options[k];
  }
  const { error } = await supabase
    .from('ebay_listings')
    .upsert(
      row as any,
      { onConflict: 'bike_id' },
    );
  if (error) throw new Error(error.message);
}

/** Fire-and-forget sync used by status changes — never blocks or throws. */
/**
 * TEMPORARY HOLD (fitted-parts rework, Checkpoint 2): automatic "list" pushes triggered by
 * stage changes are paused so half-parsed part data never reaches live listings unattended.
 * End/remove still run so sold bikes always come down. Set to false to resume.
 */
export const AUTO_LIST_PAUSED = true;

export async function syncEbayQuietly(bikeId: string, action: 'list' | 'end' | 'remove') {
  try {
    if (action === 'list' && AUTO_LIST_PAUSED) return;
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

export const previewBikeOnEbay = (bikeId: string) =>
  invoke<EbayPreview>('ebay-sync-bike', { bike_id: bikeId, action: 'preview' });

export const saveEbayListingSettings = (settings: {
  category_by_type: Record<string, string>;
  best_offer_enabled: boolean;
  best_offer_accept_pct: number;
  best_offer_decline_pct: number;
  promote_enabled: boolean;
  promote_auto: boolean;
  ad_rate: number;
}) => invoke<{ ok: true }>('ebay-oauth', { action: 'save_listing_settings', ...settings });

export const suggestEbayCategory = (query: string) =>
  invoke<{ category: PolicyOption | null }>('ebay-oauth', { action: 'suggest_category', query });

export const syncEbayOrders = () => invoke<{ ok: true; results: unknown[] }>('ebay-order-sync', {});

export const markEbayOrderDespatched = (orderRowId: string, carrier: string, trackingNumber: string) =>
  invoke<{ ok: true }>('ebay-fulfilment', { order_row_id: orderRowId, carrier, tracking_number: trackingNumber });

export async function getBikeEbayOrders(bikeId: string): Promise<EbayOrder[]> {
  const { data, error } = await supabase
    .from('ebay_orders')
    .select('id, order_id, bike_id, buyer_username, total, currency, status, carrier, tracking_number, despatched_at, created_at')
    .eq('bike_id', bikeId)
    .order('created_at', { ascending: false });
  if (error) return [];
  return (data ?? []) as EbayOrder[];
}
