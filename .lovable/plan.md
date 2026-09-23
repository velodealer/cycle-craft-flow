# eBay listing optimisation — check and Phase 1

## Where things stand today (checked)

| Item from your plan | Today |
|---|---|
| Despatch postcode | Falls back to `BN1 1AA` when not set; location name is "VeloDealer"; never updated once created |
| Condition notes | Not sent to eBay's condition box |
| Condition fallback | Swapped silently, and can swap to a *better* condition |
| Part number (MPN) | Sends the model name as the part number |
| Title | Just make + model + year + size |
| Item specifics | Hard-coded names (includes a duplicate "Type" + "Bike Type") |
| Photos | Capped at 12 |
| Category | One default for every bike, per-bike override only |
| Best Offer, Promoted Listings | Not built |
| eBay sale sync | Fulfilment permission is requested, but no order sync; marketing permission missing |

Everything in your document is still to do. As your document suggests, I'll build it one phase at a time, starting with Phase 1, and test each phase before the next.

## Phase 1 — accuracy fixes (this build)

1. **Despatch location, set by each dealer**
   - A "Despatch location" section in each dealer's eBay settings: location name (defaults to the dealership name), address line, town, postcode and country (defaults to UK). Each dealership keeps its own.
   - Postcode and town are required. The `BN1 1AA` default is removed.
   - Listing is blocked with "Set your despatch location in Settings first" when they're missing.
   - Saving pushes the new address to eBay straight away, so live listings show the right town.
   - The eBay card shows "Despatch location: {town, postcode eBay holds}".
2. **Condition notes on eBay** — the bike's condition notes go into eBay's condition description (plain text, up to 1,000 characters, cut at a sentence end). If the bike has an InspectABike grade, it goes first: "InspectABike grade: 4/5. …". Empty notes give a warning, not a block.
3. **No silent condition changes**
   - When eBay forces a different condition, we record from/to, add an activity entry and show an amber badge on the bike's eBay panel.
   - We never swap to a better condition. If that's the only option, listing is blocked with an explanation.
4. **Part number (MPN) and brand**
   - A new "Manufacturer part number (MPN)" box on each bike, next to the other bike details. Staff who can edit specs can fill it in.
   - If it's filled in, it's sent to eBay. If it's blank, nothing is sent: no model name, no "Does Not Apply".
   - The brand is trimmed and matched to eBay's spelling (e.g. "specialized" → "Specialized") when eBay provides a brand list.
5. **Category cache** — eBay's category lookups (conditions, item specifics) are kept for 24 hours per category rather than fetched on every listing. Later phases use this too.

**Done when:** a listing shows the right town, condition notes appear on eBay, and any condition swap is visible in VeloDealer.

## Next phases (separate builds, after you've tested Phase 1)

2. Smart title builder, with a title format in Listing Formats, a per-bike override and an x/80 preview.
3. Item specifics driven by eBay's category data, value matching, and an "x/y recommended filled" score.
4. Category by bike type, 24 photos with size checks, gallery photo choice, Best Offer.
5. eBay sale sync every 5 minutes, ending other channels, uploading tracking (needs a reconnect for new permissions).
6. Promoted Listings.
7. Pre-publish checklist.

## Technical details

- Migration: `ebay_category_cache` (marketplace_id, category_id, kind, payload jsonb, fetched_at, unique on the first three; service_role only, RLS on, no client policies). `ebay_listings` gains `condition_substituted_from`, `condition_substituted_to` (text, nullable). `bikes` gains `mpn` (text, nullable).
- `_shared/ebay-listing.ts`:
  - `ensureLocation()` builds the address from per-dealer settings (`location_name`, `address_line1`, `city`, `postcode`, `country`), requires city and postcode, and calls `update_location_details` when the stored address differs.
  - `inventoryItem.condition.conditionDescription` built from `condition_notes` plus the latest `inspections.overall_grade`.
  - `resolveCondition()` returns `{ id, substituted, from }` and ranks conditions so it refuses upgrades. Upgrades throw a plain error.
  - `product.mpn` set only when `bikes.mpn` is non-empty, otherwise the key is left out. Brand normalised against Brand aspect values.
  - `allowedConditionIds` and `requiredAspects` read and write through the cache helper.
- `ebay-sync-bike` logs a `bike_activity` entry for a substitution and returns warnings (missing notes, substitution).
- `ebay-oauth`: `save_settings` accepts and validates the location fields (UK postcode format, lengths) and pushes them to eBay right away. `status` returns the location eBay holds.
- `{mpn}` token added to the listing template field list. MPN box added to the bike edit form (`BikeForm.tsx`) and to the detail view.
- UI: `EbayIntegration.tsx` (required postcode, despatch status); `EbayListingCard.tsx` (amber substitution badge, warning toasts).
- `docs/ebay-listing-process.md` updated to match.
