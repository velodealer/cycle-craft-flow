# eBay listing title prefix/suffix setting

## What you'll get

A new "Listing title prefix & suffix" section in **Settings → Listing Formats → Listing channels**:

- Two text boxes per channel (eBay, Shopify, Squarespace): **Prefix** and **Suffix** — e.g. prefix "BPS ·" or suffix "· Free UK delivery".
- A live preview under each pair showing a sample title with the prefix/suffix applied.
- Saved per dealership, alongside the existing mark-up settings (no database change — stored in the same `listing_channels:<business_id>` settings entry).

## Where it applies

- **Connected eBay listings** (List on eBay / Update listing): the prefix/suffix is added around the title built from your listing template or title override.
- **eBay CSV export**: the `*Title` column gets the same prefix/suffix.
- **Shopify / Squarespace**: applied to the product title in connected syncs and CSV exports, if you fill in their boxes (leave blank for no change).

## Rules

- eBay titles are capped at 80 characters. If prefix + title + suffix would exceed 80, the middle of the title is shortened so the prefix and suffix always survive; the listing readiness check shows the final length.
- Prefix/suffix never change the bike's name inside VeloDealer — only what goes out to the channel.
- Blank prefix/suffix = today's behaviour, so existing listings are unaffected.

## Technical details

- Extend `ListingChannelSettings` in `src/lib/channelPricing.ts` and `supabase/functions/_shared/channel-pricing.ts` with `affixes: Record<Channel, { prefix: string; suffix: string }>`, normalised with trimming and a max length (e.g. 40 chars each).
- Add `applyTitleAffixes(title, affix, maxLen)` helper in both files (identical logic, like the mark-up helpers) that joins prefix/title/suffix and truncates the title middle to fit `maxLen`.
- UI: extend `ListingChannelSettings.tsx` with prefix/suffix inputs per channel + live preview.
- eBay connected path: apply in `supabase/functions/_shared/ebay-listing.ts` where `finalEbayTitle` is produced (load settings via the existing channel-price loader); cap at 80.
- CSV path: apply in `src/lib/listingCsv.ts` title builders for eBay (80 cap) and Shopify (no hard cap, use 255).
- Shopify/Squarespace connected syncs: apply where the product title is set.
- Deno tests for `applyTitleAffixes` (joining, trimming, 80-char truncation keeping affixes intact, blank = no-op).
- Redeploy the affected edge functions; typecheck the app.

## Verification

- Deno tests pass; app builds cleanly.
- I can't sign in to your app, so you'll confirm: set a prefix in Settings, then check the Listings page / a CSV export shows it.
