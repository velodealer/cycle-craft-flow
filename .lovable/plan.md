# One listing title across all channels

## Why the titles differ today

Each channel builds its title from a different recipe:

- **eBay** uses the smart title builder (`_shared/ebay-title.ts`): your listing-template format (make, model, groupset, frame material, bike type, key feature, size, wheel size, year), word de-duplication, tidy casing, and an 80-character cap that drops trailing items. A per-bike custom title (`title_override`) wins when set.
- **Shopify** (`_shared/shopify-listing.ts` `bikeTitle`) uses only `make model year (size)` — no groupset, feature or template.
- **CSV exports** (`src/lib/listingCsv.ts`) use `year make model Size colour` — a third recipe.
- **Squarespace** (`_shared/squarespace-listing.ts`) uses `year make model (size)` — a fourth.

So a bike titled "Canyon Aeroad CF SL Ultegra Carbon Road Bike Di2 56cm 2021" on eBay becomes "Canyon Aeroad CF SL 2021 (56cm)" on Shopify.

## What we'll change

Use the same smart title builder everywhere, with each channel's own length cap and prefix/suffix still applied on top:

1. **Shared builder stays in `_shared/ebay-title.ts`** (already mirrored in `src/lib/ebayTitle.ts`). Rename nothing; just reuse `finalEbayTitle(bike, titleFormat, override)` as the single source.
2. **Shopify** (`shopify-listing.ts`): replace `bikeTitle` with the shared builder, capped at 255. Loads the dealer's eBay title format from `listing_templates` the same way eBay does, so the template you edit once drives both.
3. **CSV exports** (`listingCsv.ts`): both the eBay and Shopify CSV titles come from the shared builder (80 cap for eBay, 255 for Shopify), keeping the existing prefix/suffix application.
4. **Squarespace**: same builder, 200 cap.
5. **Per-bike custom title**: when a bike has a custom title set, every channel uses it (capped to its limit), not just eBay.
6. Channel prefix/suffix, mark-ups and rounding are untouched — they already apply per channel after the title is built.

Result: apart from your per-channel prefix/suffix and the length cap, the title is identical on eBay, Shopify, Squarespace and the CSV files.

## Technical details

- `supabase/functions/_shared/shopify-listing.ts` — import `finalEbayTitle`, load `title_format` from `listing_templates` (dealer row, fallback to global), pass `title_override`.
- `supabase/functions/_shared/squarespace-listing.ts` — same swap.
- `src/lib/listingCsv.ts` — import from `src/lib/ebayTitle.ts` (the existing mirror); needs the bike's `spec_values` and `title_override`, which the export query already selects or will be extended to select.
- Title format lookup: reuse the eBay `listing_templates` row (platform `ebay`) as the single title template rather than adding a new setting.
- Update the mirrored copies together (`_shared/ebay-title.ts` and `src/lib/ebayTitle.ts` stay in step, per project rules).
- Extend the existing title-builder tests to cover Shopify/CSV paths; run typecheck and build.

## Verification

- Unit tests: same bike produces the same base title on every channel, differing only by cap and affixes.
- Build + typecheck, redeploy the affected listing functions.
- You confirm by comparing one bike's eBay and Shopify titles after the next sync/export.
