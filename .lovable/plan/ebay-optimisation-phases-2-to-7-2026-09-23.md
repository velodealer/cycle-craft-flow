# eBay optimisation — Phases 2 to 7

These get built in order, one after another. Each phase is checked before the next one starts. Phase 1 (location, condition notes, MPN) is already live.

## Phase 2 — Smart titles
- Titles are built in priority order: make, model, groupset, frame material (Carbon/Titanium/Steel), bike type, key feature (Di2/eTap/Disc/Full Suspension/motor brand), size (e.g. 56cm, Medium), wheel size (for MTB and gravel), then year.
- Repeated words are removed. If the title is over 80 characters, the lowest-priority item is dropped until it fits, so words are never cut in half. Shouting is tidied up, but known acronyms (BMX, XL, Di2, SRAM, AXS) stay in capitals.
- **Listing Formats → eBay** gets a "Title format" box, e.g. `{make} {model} {groupset} {frame_material} {bike_type} {feature} {size}`. Items later in the format are dropped first.
- The bike's eBay panel shows a live title preview with an x/80 count, plus an optional "Custom title" box for that bike.

## Phase 3 — Full item specifics
- Item specifics follow eBay's own list for the chosen category: required and recommended ones are filled whenever we have the data. The duplicate "Type" is no longer sent.
- New ones include: handlebar type, groupset, features, tyre width, department/gender and country of manufacture. For e-bikes: motor power, battery capacity, range, motor position and motor brand.
- Our values are matched to eBay's choices (56 / 56 cm / 56cm, 700c, 2x11 → 22, M → Medium). Where eBay only accepts its own values and nothing matches, the item is left off and appears in a "Couldn't match" list.
- The panel shows "Item specifics: 14/19 recommended filled", with the missing ones named. Only *required* specifics block a listing.

## Phase 4 — Category per bike type, photos, Best Offer
- **eBay settings:** a table matching each bike type to an eBay category, with a "Suggest" button. Everything starts on the current default. A bike's own category wins, then its type's category, then the default.
- **Photos:** up to 24 are sent (was 12). You're warned when a bike has fewer than 6 photos, or any photo is under 1600px. A photo under 500px blocks the listing. You can choose the main (gallery) photo on the bike's eBay panel.
- **Best Offer:** off by default. Settings: auto-accept at 95% and auto-decline below 80% of the asking price (both editable), with an on/off switch per bike. Customer service can switch Best Offer on or off, but can't see the percentages.

## Phase 5 — eBay sales come in automatically
- The eBay card asks you to reconnect if the connection is missing the new permissions ("Reconnect eBay to enable sale sync and promotion").
- Every 5 minutes, VeloDealer checks each dealer's new eBay orders. For each sold bike it:
  - marks the bike sold at the eBay price
  - saves the order
  - takes the bike off Shopify
  - adds an activity entry and emails the dealer
- The same order is never processed twice.
- A bike marked sold or reserved in VeloDealer by any other route ends its eBay listing automatically.
- An eBay order has a "Mark despatched" action with carrier and tracking. If the bike goes with Cycle Courier, the carrier and tracking are filled in for you.

## Phase 6 — Promoted Listings (owner/admin settings)
- Settings: switch on, default ad rate (e.g. 5%), and "promote every new listing".
- On first use, one "VeloDealer auto" campaign (you pay only when the item sells) is created for each dealer.
- New listings are added to the campaign at the default rate or the bike's own rate. The ad is removed when a listing ends. The panel shows "Promoted at X%". Customer service can see the rate but not change it.

## Phase 7 — Pre-publish checklist
Before listing, the bike's eBay panel shows a traffic-light checklist:
- title and its length
- required and recommended specifics
- photo count and size
- condition notes
- category and condition as eBay will receive them (including any condition change)
- the first ~800 characters of the description, as buyers see it on mobile
- despatch location, policies, and whether Best Offer and promotion are on

Red items block listing; amber items only warn.

## What you'll need to do
- **After Phase 5:** reconnect eBay once in Settings, to grant the sales and promotion permissions.
- **Before Phase 6:** Promoted Listings needs an eBay account that's eligible for ads. In sandbox this may not work fully.

## Technical details
- **Migration:**
  - `ebay_listings`: `title_override`, `best_offer_enabled` (nullable), `ad_rate`, `ad_id`, `gallery_photo_index`, `unmapped_aspects` jsonb, `aspect_summary` jsonb.
  - New `ebay_orders` (business_id, order_id unique per business, bike_id, buyer_username, total, currency, status, line_item_id, tracking fields, raw jsonb, timestamps), with grants and RLS for business members and super admin; service_role writes.
  - `listing_templates` gains `title_format` text.
- **Settings** (in `integrations.settings`): `category_by_type`, `best_offer_enabled`, `best_offer_accept_pct`, `best_offer_decline_pct`, `promote_enabled`, `promote_auto`, `ad_rate`, `campaign_id`, `last_order_sync_at`, `granted_scopes`.
- **Code:**
  - `_shared/ebay-title.ts` builds titles; it's mirrored in `src/lib/ebayTitle.ts` for the preview.
  - `_shared/ebay-aspects.ts` holds the mapping table, normalisers and completeness; it uses the Phase 1 `ebay_category_cache`.
  - `pushBikeToEbay` sets up to 24 images with the gallery photo first, adds `bestOfferTerms` to `listingPolicies`, and creates the ad after publish. `endEbayListing` and `deleteEbayListing` remove the ad.
- **Scopes:** add `sell.marketing` to `EBAY_SCOPES` (`sell.fulfillment` is already requested). Save the granted scopes when connecting; `status` returns `needs_reconnect`.
- **New edge functions:**
  - `ebay-order-sync`: scheduled every 5 minutes via pg_cron + pg_net if they're available (otherwise a scheduled call). It reuses the existing sale/invoice path and ends Shopify listings via existing helpers.
  - `ebay-fulfilment`: "Mark despatched" (`shipping_fulfillment`).
- **Other functions:**
  - `ebay-sync-bike` gains a `preview` action that returns the title, specifics score, photo checks and checklist without publishing.
  - `ebay-oauth` gains `suggest_category` and saves the new settings. It strips the Best Offer percentages from `status` for customer_service.
- Photo sizes are checked with the image header (dimensions only), and the result is cached per URL.
- **UI:**
  - `EbayListingCard.tsx`: title preview and override, specifics score, photo picker, Best Offer switch, promoted badge, checklist.
  - `EbayIntegration.tsx`: category-by-type table, Best Offer, promotion, reconnect banner.
  - `ListingFormats.tsx`: title format box.
  - An eBay orders list on the bike page with "Mark despatched".
- `docs/ebay-listing-process.md` updated after each phase.
