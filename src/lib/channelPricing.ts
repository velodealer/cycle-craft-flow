// Keep identical to supabase/functions/_shared/channel-pricing.ts.
export type Channel = 'ebay' | 'shopify' | 'squarespace';
export type Rounding = 'none' | '5' | '10' | '99';
export interface MarkupRule { pct: number; round: Rounding }
export interface ListingChannelSettings {
  manual: { ebay: boolean; shopify: boolean };
  markups: Record<Channel, MarkupRule>;
}

export const listingChannelsKey = (businessId: string) => `listing_channels:${businessId}`;

const rule = (r: any): MarkupRule => ({
  pct: Number.isFinite(Number(r?.pct)) ? Math.max(0, Math.min(500, Number(r.pct))) : 0,
  round: ['none', '5', '10', '99'].includes(r?.round) ? r.round : 'none',
});

export function normaliseChannelSettings(raw: any): ListingChannelSettings {
  return {
    manual: { ebay: raw?.manual?.ebay === true, shopify: raw?.manual?.shopify === true },
    markups: { ebay: rule(raw?.markups?.ebay), shopify: rule(raw?.markups?.shopify), squarespace: rule(raw?.markups?.squarespace) },
  };
}

/** Asking price plus the channel mark-up, then rounded up to the chosen ending. */
export function applyChannelMarkup(price: number | null | undefined, r?: MarkupRule | null): number | null {
  const base = Number(price);
  if (price == null || !Number.isFinite(base) || base <= 0) return price == null ? null : base;
  const { pct, round } = rule(r);
  const raw = base * (1 + pct / 100);
  if (pct === 0) return Math.round(base * 100) / 100;
  if (round === '5') return Math.ceil(raw / 5) * 5;
  if (round === '10') return Math.ceil(raw / 10) * 10;
  if (round === '99') return Math.ceil(raw) - 0.01;
  return Math.round(raw * 100) / 100;
}
