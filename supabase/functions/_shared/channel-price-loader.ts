import { applyChannelMarkup, listingChannelsKey, normaliseChannelSettings, type Channel, type ListingChannelSettings } from './channel-pricing.ts';

/** Loads the dealership's listing-channel settings (mark-ups, manual toggles, title affixes). */
// deno-lint-ignore no-explicit-any
export async function loadChannelSettings(supabase: any, businessId: string): Promise<ListingChannelSettings> {
  const { data, error } = await supabase.from('app_settings').select('value').eq('key', listingChannelsKey(businessId)).maybeSingle();
  if (error) throw new Error(`Could not load channel settings: ${error.message}`);
  return normaliseChannelSettings(data?.value);
}

/** Returns the bike's asking price with the dealership's mark-up for this channel. */
// deno-lint-ignore no-explicit-any
export async function channelPrice(supabase: any, businessId: string, channel: Channel, asking: number | null | undefined) {
  const settings = await loadChannelSettings(supabase, businessId);
  return applyChannelMarkup(asking, settings.markups[channel]);
}
