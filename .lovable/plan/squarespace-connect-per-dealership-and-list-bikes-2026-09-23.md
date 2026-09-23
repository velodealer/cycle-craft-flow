# Squarespace: connect per dealership and list bikes

## What dealers get
- **Settings → Integrations → Squarespace** card: "Connect Squarespace" sends them to Squarespace to approve, then back to VeloDealer. Shows site name, which store page bikes go into (picker), and Disconnect.
- **On each bike** a Squarespace panel (like Shopify's): List, Update, Mark sold / Remove, with a link to the live product.
- **Listings page**: Squarespace badge, "List on Squarespace" button, and it joins "List everywhere", "List all bikes" and "Sync all listings".
- **Sales**: when a bike sells on Squarespace it's marked sold, taken off eBay/Shopify and logged in its activity (same as eBay sales). Selling elsewhere removes/marks it sold out on Squarespace.
- Same roles as Shopify listing (admin, owner, customer service…); costs never sent.

## Setup needed from you
1. In your Squarespace developer app, set the redirect URL to `https://api.velodealer.com/functions/v1/squarespace-oauth`.
2. Paste the client ID and secret into a secure form I'll open (saved as `SQUARESPACE_CLIENT_ID`, `SQUARESPACE_CLIENT_SECRET` — never in code).

## What goes to Squarespace
Title, description (your listing format with platform "squarespace", falling back to the website format), price, SKU = bike reference, stock 1, up to the allowed number of photos, and the bike's key specs as product variant attributes (size, colour).

## Technical details
- Migration: `squarespace_oauth_states` (state PK, business_id, user_id, created_at; 10-min expiry, one-time use) and `squarespace_listings` (bike_id, business_id, product_id, variant_id, url, status 'listed'|'sold_out'|'removed', last_synced_at, last_error). GRANTs + RLS scoped by business, super admin read. Tokens stored in `integrations` (name 'squarespace', business_id — existing partial unique index), service-role only, never returned to browser.
- Edge function `squarespace-oauth` (verify_jwt false): `start` builds `https://login.squarespace.com/api/1/login/oauth/provider/authorize` with scopes `website.products,website.inventory,website.orders.read`, `access_type=offline`, state; callback exchanges code at `https://login.squarespace.com/api/1/login/oauth/provider/tokens` (Basic auth), saves access + refresh tokens and expiry, fetches site info (`/1.0/authorization/website`), redirects to Settings. Actions: status, disconnect (revokes + clears), list_store_pages (`/1.0/commerce/store_pages`), set_store_page. Access tokens last 30 min — `_shared/squarespace.ts` refreshes automatically.
- `_shared/squarespace-listing.ts` + `squarespace-sync-bike` function: create/update product via Products API v2 (`/1.0/commerce/products`, images uploaded separately), inventory set via Inventory API, sold_out/remove actions; activity logged via logBikeActivity.
- `squarespace-webhook` (verify_jwt false): registers `order.create` subscription on connect (`/1.0/webhook_subscriptions`), verifies the signature with the subscription secret, maps SKU → bike, marks sold. Existing sold/reserved paths call syncSquarespaceQuietly alongside eBay/Shopify.
- Frontend: `src/services/squarespace.ts`, `SquarespaceIntegration.tsx` in Integrations tab, `SquarespaceListingCard.tsx` on BikeDetailView, ListingsPage extended with a third platform. Listing format editor gains a "Squarespace" platform option.
- Docs: Squarespace requires app approval/listing before non-test sites can connect; until then only sites you own can authorise.
