# Listings page

## What it does
A new **Listings** page in the Stock section of the sidebar (between Bikes and Parts) at `/listings`, visible to the same roles as the Bikes page (admin, mechanic, detailer, accountant, customer_service).

It shows bikes whose status is **Ready** or **Listed** and, for each bike, which sales platforms it is currently live on, plus a **List everywhere** button.

## Page layout
- Page header: "Listings — bikes ready to go live, and what they're listed on."
- Cards reuse the existing `ListCard` / `ListCardRow` pattern from `BikeList`, showing: thumbnail, reference, make/model, year, stage flap (Ready/Listed), location/bay, asking price (hidden from roles that can't see money, same rule as Bikes).
- **Platform badges** per bike, fetched from `ebay_listings` and `shopify_listings` for the loaded bikes:
  - eBay: `status === 'listed'` → green "eBay" badge linking to the listing URL; a stored row with status `ended` shows a muted "eBay · ended" badge.
  - Shopify: `status === 'listed'` → green "Shopify" badge with product link; `sold_out` shows muted "Shopify · sold out"; no row → no badge.
- **List everywhere** button on every card:
  - Calls `listBikeOnEbay` and `listBikeOnShopify` for each platform that is connected and where the bike isn't already actively listed.
  - Shows per-platform success/error toasts (surfaces warnings like the pre-publish checklist blockers from `ebay-sync-bike`).
  - When the platform is connected but the bike is already listed there, the badge reads "Listed" and the button skips it; if both connected platforms already list the bike, the button is replaced by "Listed everywhere" (disabled).
  - When neither eBay nor Shopify is connected, the button is disabled with a note pointing to Settings → Integrations.
- Simple search box (reference / make / model) and a status filter (Ready / Listed / All) — matching the filtering style of `BikeList`.
- Card click navigates to the bike's detail page, same as Bikes.

## Data & wiring (no database changes needed)
- `src/pages/ListingsPage.tsx` — new page: loads bikes with `status in ('ready','listed')`, then fetches `ebay_listings` (bike_id, listing_url, status, last_synced_at, last_error) and `shopify_listings` (bike_id, product_url, status, last_synced_at, last_error) with `.in('bike_id', ids)`. RLS already scopes everything to the dealer's business.
- Platform connection state via existing `getEbayStatus()` and `getShopifyStatus()` (already role-aware).
- Listing actions via existing services `listBikeOnEbay` / `listBikeOnShopify` — no new edge functions.
- `src/App.tsx` — add route `/listings`.
- `src/components/AppSidebar.tsx` — add "Listings" item (icon: Globe or Megaphone) to the Stock group with the Bikes-page roles.

## Verification
- Typecheck and build clean.
- Playwright pass: page renders empty state gracefully; sidebar link works; a ready bike with a stored eBay/Shopify row shows the right badges; List button behaves per connection state (mocked or using existing sandbox data).
