import { applyChannelMarkup, listingChannelsKey, normaliseChannelSettings, type Channel } from './channel-pricing.ts';

/** Returns the bike's asking price with the dealership's mark-up for this channel. */
// deno-lint-ignore no-explicit-any
export async function channelPrice(supabase: any, businessId: string, channel: Channel, asking: number | null | undefined) {
  const { data, error } = await supabase.from('app_settings').select('value').eq('key', listingChannelsKey(businessId)).maybeSingle();
  if (error) throw new Error(`Could not load channel pricing: ${error.message}`);
  return applyChannelMarkup(asking, normaliseChannelSettings(data?.value).markups[channel]);
}
