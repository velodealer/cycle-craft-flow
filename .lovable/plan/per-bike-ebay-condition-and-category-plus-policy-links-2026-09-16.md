# Per-bike eBay condition and category, plus policy links

## What changes

**On each bike page (eBay panel)**
- Two new fields appear above the listing buttons: "Item condition" (same list as today) and "eBay category number", with a category search box like the one in Settings.
- Both start from the values chosen in Settings, so nothing extra is needed for a normal bike — change them only when a bike differs (e.g. a bike sold for parts, or an e-bike in a different category).
- The choice is saved against that bike and used every time it is listed or updated, including automatic listing when the bike becomes ready.

**In Settings → Integrations → eBay**
- Condition and category stay, relabelled as the defaults applied to new bikes.
- Next to the postage, payment and returns pickers, add a "Create or edit policies on eBay" link that opens eBay's business policies page in a new tab (sandbox or production address depending on the connected environment), plus a "Refresh policies" action so newly created policies show up without reconnecting.

## Technical notes

- Migration: add `condition text` and `category_id text` (both nullable) to `ebay_listings`; nullable means "use the account default". Keep existing RLS/grants.
- `EbayListingCard.tsx`: load the bike's row plus `getEbayStatus()` defaults; add condition select, category input and category search (reuse `searchEbayCategories`); save via a new `saveBikeEbayOptions(bikeId, {condition, category_id})` in `src/services/ebay.ts`, which upserts the `ebay_listings` row on `bike_id`.
- `supabase/functions/_shared/ebay-listing.ts`: read the existing `ebay_listings` row before building the payload (already fetched) and resolve `condition = row.condition || s.condition || 'USED_EXCELLENT'` and `categoryId = row.category_id || s.category_id || DEFAULT_CATEGORY`; make sure the final `upsertListing` does not overwrite these columns.
- Policy links: business policies live at `https://www.bizpolicy.ebay.co.uk/businesspolicy/manage` (production) and `https://www.bizpolicy.sandbox.ebay.co.uk/businesspolicy/manage` (sandbox); pick by `status.environment`. Refresh button re-invokes `getEbayPolicies()`.
- Redeploy `ebay-sync-bike` after the shared-file change.
