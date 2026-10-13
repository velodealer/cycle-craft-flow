# Per-bike "List on Shopify (manual)" button

## What changes
When the dealership has **not** connected Shopify, each bike gets a **List on Shopify (manual)** button that downloads a Shopify product-import CSV for just that bike.

- **Listings page**: on each bike row, where the "List on Shopify" button sits for connected stores, show "List on Shopify (manual)" instead. Clicking it downloads that bike's CSV straight away.
- **Bike page**: the Shopify listing card shows the same button plus a short note: "Shopify isn't connected — download this file and import it in Shopify admin → Products → Import."
- The file uses the same contents as the existing bulk Shopify export: full details, spec metafields, listing images only, Shopify mark-up and title prefix/suffix.
- File name: `shopify-<bike reference>.csv`.
- If the bike has no listing images, or other required details are missing, the download is still allowed but a warning lists what's missing, matching the bulk export.
- The button appears whether or not the "Shopify manual listing" setting is on. When Shopify is connected, the button is hidden.

## Technical details
- Reuse `buildListingCsv('shopify', [bikeId], markups.shopify, affixes.shopify)` and `downloadCsv` from `src/lib/listingCsv.ts`.
- `ListingsPage.tsx`: at the `shopifyConnected && renderPlatformButton(...)` spot (~line 659), add the `!shopifyConnected` branch that renders the manual button, with a per-bike loading state.
- `ShopifyListingCard.tsx`: when the status reports not connected, render the manual button. Load channel settings from the existing `listing_channels:<business_id>` source.
- Override the filename to use the bike reference.
- No database or server function changes.
