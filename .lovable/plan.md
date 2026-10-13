# Separate listing photos from intake photos

## What changes
1. Remove the fallback: eBay, Shopify, Squarespace and CSV exports will use **only** the bike's dedicated Listing images. Intake/workshop photos will never be sent to any marketplace.
2. A bike with no listing images will fail its photo checks ("Add listing images") instead of silently using intake photos — in the eBay preview, the Fix Listing Problems popup, and the listing-readiness checks.
3. The bike page, CSV exports and listing previews all read from the same rule, so behaviour is identical everywhere.

## What stays the same
- Intake photos remain untouched and still show on the bike page, inspection, cleaning and logistics views.
- Uploading, removing and reordering listing images works exactly as it does now.

## Consequence to be aware of
- Bikes that currently rely on the fallback (listing images empty) will show as not photo-ready until listing images are added. No existing live eBay/Shopify listing is changed — this only affects new or re-synced listings.

## Technical notes
- Change `effectiveListingImages` in `src/lib/listingImages.ts` and `supabase/functions/_shared/listing-images.ts` to return only valid `listing_photos` (no `photos` fallback).
- Update the shared tests in `supabase/functions/_shared/listing-images_test.ts` to assert intake photos are never used.
- All consumers (`ebay-listing.ts`, `shopify-listing.ts`, `squarespace-listing.ts`, `listingCsv.ts`, `listingReadiness.ts`, `EbayListingCard.tsx`, `FixListingProblemsDialog.tsx`, `ListingsPage.tsx`, `BikeDetailView.tsx`) pick up the rule automatically since they all call the shared helper; verify each still handles the empty case with a clear "add listing images" message.
- Redeploy the affected edge functions.

## Validation
- Unit tests: listing images only, empty when none set, intake photos never returned.
- Build and typecheck pass.
- Preview check: a bike with only intake photos shows the photo checklist failure on the eBay preview; adding a listing image clears it.
