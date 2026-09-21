# Fix eBay's 4,000-character description limit

## Problem
eBay's Inventory API caps the item description at 4,000 characters. Your saved eBay listing format renders longer than that for some bikes (e.g. BPS-TRE-027T), so the listing fails with "Invalid value for description. The length should be between 1 and 4000 characters." The Trading API doc you found allows much longer descriptions, but the app lists through the newer Inventory API, where the 4,000-character cap is hard — so the fix is to make what we send fit.

## What we'll build

### 1. Automatic trimming when the description is too long
In the eBay listing code (`supabase/functions/_shared/ebay-listing.ts`), after the listing format is rendered:

1. If it fits within 4,000 characters — send as-is (no change for most bikes).
2. If too long, retry in steps until it fits:
   - **Step 1:** drop the components list from the description (usually the biggest block).
   - **Step 2:** shorten the rendered text, cutting at a sentence/paragraph boundary around 3,900 characters and ending with "…".
3. Whatever is finally sent is counted on the HTML eBay actually receives, so it can never exceed the limit again.

### 2. Clear warning when trimming happened
- The bike's Activity timeline gets an entry noting the description was trimmed to fit eBay's limit (and which step was used), so you can see it happened and tidy the format if you want the full text.
- If even the shortest version can't fit (extremely unlikely), the listing stops with a plain-English message telling you the eBay listing format is too long and to shorten it in Settings → Listing Formats.

### 3. Same protection for Shopify
Apply the same length check to the Shopify sync so a long format can't fail there either (Shopify's limit is far more generous, so this is just a safety net).

## Technical details
- Changes confined to `supabase/functions/_shared/ebay-listing.ts` (trim logic + activity log) and a small shared helper; Shopify sync gets the guard only.
- Character counting done on the final HTML string sent to eBay.
- Redeploy `ebay-sync-bike` (and `shopify-sync-bike` for the guard) when done.

## Result
Listing BPS-TRE-027T (and any bike with a long format) succeeds. Descriptions that fit are untouched; over-long ones are shortened sensibly and the trim is recorded on the bike's activity feed.
