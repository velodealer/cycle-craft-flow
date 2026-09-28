// Keep identical to src/lib/channelPricing.ts.
export type Channel = 'ebay' | 'shopify' | 'squarespace';
export type Rounding = 'none' | '5' | '10' | '99';
export interface MarkupRule { pct: number; round: Rounding }
export interface TitleAffix { prefix: string; suffix: string }
export interface ListingChannelSettings {
  manual: { ebay: boolean; shopify: boolean };
  markups: Record<Channel, MarkupRule>;
  affixes: Record<Channel, TitleAffix>;
}

export const listingChannelsKey = (businessId: string) => `listing_channels:${businessId}`;

const rule = (r: any): MarkupRule => ({
  pct: Number.isFinite(Number(r?.pct)) ? Math.max(0, Math.min(500, Number(r.pct))) : 0,
  round: ['none', '5', '10', '99'].includes(r?.round) ? r.round : 'none',
});

const affix = (a: any): TitleAffix => ({
  prefix: String(a?.prefix ?? '').replace(/\s+/g, ' ').trim().slice(0, 40),
  suffix: String(a?.suffix ?? '').replace(/\s+/g, ' ').trim().slice(0, 40),
});

export function normaliseChannelSettings(raw: any): ListingChannelSettings {
  return {
    manual: { ebay: raw?.manual?.ebay === true, shopify: raw?.manual?.shopify === true },
    markups: { ebay: rule(raw?.markups?.ebay), shopify: rule(raw?.markups?.shopify), squarespace: rule(raw?.markups?.squarespace) },
    affixes: { ebay: affix(raw?.affixes?.ebay), shopify: affix(raw?.affixes?.shopify), squarespace: affix(raw?.affixes?.squarespace) },
  };
}

/**
 * Wraps a listing title with the channel's prefix/suffix. When the result would
 * exceed maxLen, the title middle is shortened (never mid-word) so the prefix
 * and suffix always survive. Blank affixes return the title unchanged.
 */
export function applyTitleAffixes(title: string, a?: TitleAffix | null, maxLen = 80): string {
  const t = String(title ?? '').replace(/\s+/g, ' ').trim();
  const { prefix, suffix } = affix(a);
  if (!prefix && !suffix) return t.slice(0, maxLen);
  const pre = prefix ? `${prefix} ` : '';
  const suf = suffix ? ` ${suffix}` : '';
  const room = maxLen - pre.length - suf.length;
  let mid = t;
  if (mid.length > room) {
    mid = mid.slice(0, Math.max(0, room)).replace(/\s+\S*$/, '').trim();
  }
  return `${pre}${mid}${suf}`.trim();
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
