# Add an "ends in 9" rounding option for channel mark-ups

## What changes
- Settings → Listings → channel mark-ups gets a new rounding choice: **Ends in 9 (e.g. £2,339)**.
- How it works: after the mark-up is added, the price goes up to the next round £10 and then has £1 taken off.
  - £2,340 becomes £2,339
  - £2,341 becomes £2,349
  - £2,198.90 becomes £2,199
- The new rounding applies everywhere mark-ups are already used: connected eBay, Shopify and Squarespace listings, plus the eBay and Shopify CSV downloads.
- The existing options (none, nearest £5, nearest £10, .99) stay the same.

## Technical notes
- Add `'9'` to `Rounding` and the allowed list in both `src/lib/channelPricing.ts` and `supabase/functions/_shared/channel-pricing.ts`, keeping the two files identical: `Math.ceil(raw / 10) * 10 - 1`.
- Add the option to the rounding select in `src/components/settings/ListingChannelSettings.tsx`.
- Add tests to `_shared/channel-pricing_test.ts`: a mark-up that gives 2340 should come out as 2339, and one that gives 2341 should come out as 2349. Then redeploy the eBay, Shopify and Squarespace sync functions.
