# Shopify metafields use the same detail as eBay item specifics

## Problem
- Shopify metafields (CSV export and live sync) fill parts with only brand + model, using their own simple formatter. eBay item specifics use the shared fitted-parts resolver, which adds the part code (e.g. Shimano Ultegra FC-R8000), resolves per-size values and avoids repeated brands.
- When a bike has no fitted part for a slot (e.g. groupset, wheels, tyres), Shopify leaves the metafield blank. eBay falls back to the 99Spokes spec values for those.
- Result: crankset and front derailleur metafields show no part code, and groupset/wheels/tyres stay empty, even when eBay shows them.

## What changes
1. One value builder for both channels: each Shopify metafield mapped to a fitted part or spec gets exactly the text eBay would send for the matching item specific (brand + model + part code, deduplicated, size-resolved).
2. Fallback order per metafield: fitted part, then the bike's 99Spokes spec value, then blank (never invented).
3. Groupset, Wheels and Tyres automatically map to the same sources eBay uses when the dealer hasn't chosen anything.
4. Applies to the bulk Shopify CSV, the per-bike "List on Shopify (manual)" download, and live Shopify sync.
5. Check the bike you mentioned: confirm whether its groupset/wheels/tyres and the R8070 codes exist in its spec or fitted parts. If the codes aren't stored anywhere, the listing can't show them; the technician adds them on the bike page (nothing is invented).

## Technical details
- Extract the per-slot value function used by `_shared/ebay-aspects.ts` (`buildAspects`) into a shared helper, mirrored in `src/lib/` (same rule as the title builder: keep in step).
- `src/lib/shopifyTemplate.ts` `resolveSource` and `_shared/shopify-listing.ts` `buildMetafields` call that helper for `part:` and `spec:` sources, with part to spec fallback.
- Default mappings for groupset/wheelset/tyres in `autoMatch`.
- Tests: Shopify metafield value equals eBay aspect value for the same bike; fallback to spec when no fitted part; MPN included when stored.
- Redeploy shopify sync functions. No database changes.
