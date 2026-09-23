# Fix eBay problems in one popup, and capture listing details when a bike is added

## 1. "Fix eBay problems" popup
Wherever a bike has an eBay error or red checklist items (the "eBay error" badge on the Listings page, and the bike's eBay panel), a **Fix problems** button opens one popup listing every problem at once.

- Each problem is shown with a plain explanation and the box to fix it right there:
  - Missing asking price, bike type, size, colour, frame material, wheel size, condition, condition notes, MPN
  - Missing eBay item specifics the category requires (e.g. Brake Type, Suspension Type): each shown as a box, with eBay's allowed choices as a dropdown when eBay gives them
  - Too few / too small photos: upload right in the popup
  - Title too short: edit the custom title with the x/80 counter
- Problems that live in Settings (postage/payment/returns policies, despatch location) show a link to the right Settings page instead, because they apply to every bike. Customer service sees these as "Ask an admin".
- The latest eBay refusal message (e.g. "The item specific Bike Type is missing") is read and matched to the right box where possible; anything we can't match is shown as the raw message at the bottom.
- **Save & retry** saves everything to the bike, re-runs the checks, and lists it on eBay. If eBay still refuses, the popup stays open with only the remaining problems.
- Listings page: the badge becomes clickable, and "List all bikes" collects every failed bike into a "3 bikes need fixing" link that opens the popup bike by bike.

## 2. Smoother "Add bike"
Goal: everything eBay, Shopify and Squarespace need is captured once, when the bike comes in.

- **Start with the catalogue:** the add form opens with "Find this bike" (99spokes lookup) at the top. Picking a match fills make, model, year, type, frame material, wheel size, groupset, colour options, sizes and fitted parts before anything is typed.
- **"Ready to list" section** in the form, showing only what's still blank, with a progress bar ("7 of 10 listing details filled"):
  bike type, size, colour, frame material, wheel size, condition, condition notes, asking price, photos (at least 4), MPN (optional).
  Choices are dropdowns using eBay's own wording, so no conversion is needed later.
- Nothing is forced: the bike can still be saved with gaps (intake often happens before photos). The bike's page then shows a "Listing details: 3 missing" banner that opens the same popup from part 1.
- The same completeness check drives the Listings page: bikes with gaps show a small amber "3 details missing" note before anyone presses List.

## Technical details
- Shared readiness list `src/lib/listingReadiness.ts`: `missingListingFields(bike, photos)` returns `{ key, label, input: 'select'|'text'|'number'|'photos', options? }`. Used by BikeForm, the bike banner, Listings page and the popup.
- `ebay-sync-bike` action `preview` already returns `checklist` and `aspects.missing_required`; extend it to return, for each missing required aspect, eBay's allowed values (from the cached category metadata) and to parse `last_error` into a checklist key where it names a field or aspect.
- New `src/components/bike/FixListingProblemsDialog.tsx`: loads preview, renders one input per block item, saves bike columns via `bikes.update`, stores filled aspects in `bikes.spec_values.ebay_aspects` (read by `aspects()` in `_shared/ebay-listing.ts` as overrides), uploads photos via existing `photoUpload`, logs activity, then calls `listBikeOnEbay` and re-runs preview.
- `EbayListingCard.tsx` and `ListingsPage.tsx` open the dialog; "List all" collects failures into a queue.
- `BikeForm.tsx`: move `BikeCatalogLookup`/Spokes lookup to the top on add; add the "Ready to list" section using the readiness list; dropdown values for type/condition/wheel size match `EBAY_BIKE_TYPE` and `CONDITION_ID` keys.
- No new tables. Redeploy `ebay-sync-bike`.
