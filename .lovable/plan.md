# Use the eBay listing format for the item description

## Why it doesn't today

The "Copy listing" button on a bike uses your saved eBay listing format. The automatic
eBay listing does not — it builds its own description from scratch (the bike's listing
description plus a short bullet list of size, colour, type, material, condition and
included items). The listing format is only read in the app, never by the part of the
system that talks to eBay.

## The change

When a bike is listed or updated on eBay, use the saved eBay listing format to build the
item description.

- Load the eBay format; if it is empty or missing, fall back to today's built-in
  description so listings never break.
- Fill in the same placeholders the copy button supports (title, make, model, year,
  colour, size, condition, description, prices, reference, photos, components, etc.),
  using the bike and its fitted components.
- If the format is saved as plain text, convert line breaks to HTML so eBay renders it
  properly; HTML formats are sent as-is.
- Strip anything eBay rejects in descriptions (scripts, iframes, form tags) before sending.

## Technical notes

- Add `supabase/functions/_shared/listing-template.ts`: a Deno copy of the token map and
  `renderTemplate` from `src/lib/listingTemplate.ts`, plus a loader for the `listing_templates`
  row where `platform = 'ebay'` (service client, business-scoped where the row carries
  `business_id`).
- `bikeDescriptionHtml(bike)` in `_shared/ebay-listing.ts` becomes async and takes the
  rendered template when one exists; `pushBikeToEbay` fetches the template and the bike's
  `bike_components` (with `components(name, brand, model, component_categories(name))`)
  once and reuses the result for both the inventory item `description` and the offer
  `listingDescription`.
- Redeploy `ebay-sync-bike` (and any other function importing `pushBikeToEbay`).
