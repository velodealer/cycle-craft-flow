# Shopify: connect a store and keep bike listings in sync

Let a dealer link their own Shopify store to VeloDealer, push bikes onto it as products, and keep stock in step both ways. Shopify has no ready-made Lovable connector for this, so it is built the same way QuickBooks and Typeform already are: a "Connect Shopify" button in Settings → Integrations, an approval screen at Shopify, and the store's access saved against the integration.

## 1. Connecting a store

- New Shopify card in Settings → Integrations (admin/owner only), matching the QuickBooks card.
- The user types their store address (e.g. `my-shop.myshopify.com`), presses Connect, approves on Shopify, and lands back on Settings with a "Shopify connected" confirmation showing the store name.
- Disconnect removes the saved access; listings already on Shopify are left alone.
- A small settings area on the card: which sales channel/collection new bikes go into, whether auto-listing is on, and the default product type/vendor wording.

## 2. Putting bikes on Shopify

- Auto: when a bike reaches Ready or Listed it is published to Shopify as an active product, quantity 1.
- Manual: a "List on Shopify" / "Update listing" / "Remove listing" set of actions on the bike page, so staff can push early, re-push after edits, or pull a listing.
- What gets sent: title (make, model, year, size), the listing description already used for the other channels, asking price, photos, and tags for type, size, colour and frame material. The VeloDealer reference goes in the SKU so the two systems always match.
- Re-listing the same bike updates the existing product rather than creating a duplicate.
- Each bike shows its Shopify state on the bike page: not listed / listed (with a link to the product) / sold, plus the last sync time and any error.

## 3. Sold elsewhere

When a bike is marked sold in VeloDealer (or otherwise leaves stock — broken for parts, deleted), its Shopify product stays active but its stock is set to zero, so it shows as sold out rather than disappearing.

## 4. Sold on Shopify

A Shopify order containing one of our products marks that bike sold in VeloDealer, using the Shopify line price as the sale price, and runs the normal sale steps (invoice, accounting postings, stock reduction). Refunded or cancelled Shopify orders put the bike back into stock and reverse the sale, matching the existing reversal behaviour.

## 5. What you'll need

A Shopify app in your Shopify Partner account (public or custom), giving an API key and secret — these get saved securely. Its redirect address will be the VeloDealer callback, which I'll give you once the function is deployed.

## Technical notes

- Secrets: `SHOPIFY_CLIENT_ID`, `SHOPIFY_CLIENT_SECRET`, plus a generated `SHOPIFY_WEBHOOK_SECRET` fallback (Shopify signs webhooks with the app secret, used for HMAC verification).
- Schema: a `shopify_listings` table (`bike_id` unique, `product_id`, `variant_id`, `inventory_item_id`, `location_id`, `status`, `last_synced_at`, `last_error`) with RLS via `public.has_any_role` and GRANTs for `authenticated` + `service_role`; connection state (shop domain, access token, scopes, settings) lives in the existing `integrations` table as `name='shopify'`.
- Edge functions (all added to `supabase/config.toml`):
  - `shopify-oauth` (`verify_jwt = false`): actions `status`, `auth_url` (shop domain + state carrying app origin, same fix as Typeform), OAuth callback → token exchange → 302 back to `/settings?tab=integrations&shopify=connected`, `disconnect`, `save_settings`; registers `orders/paid`, `orders/cancelled`, `refunds/create` webhooks on connect.
  - `shopify-sync-bike` (JWT, staff roles): create/update/unlist a single bike; Admin GraphQL `productSet`/`productUpdate` plus `inventorySetQuantities`; idempotent on stored `product_id`; writes `shopify_listings`.
  - `shopify-webhook` (`verify_jwt = false`): verifies `X-Shopify-Hmac-Sha256` (base64 HMAC-SHA256 of the raw body with the app secret), matches line items by SKU → bike reference, and reuses the existing sale/reversal code paths.
- Scopes: `write_products,read_products,write_inventory,read_inventory,read_orders,read_locations`.
- Auto-listing and zero-stock-on-sale hook into the same places the current status changes run (stage advance, `AdminStatusSelect`, `RecordSaleDialog` / sale reversal, break-for-parts, delete-bike), each call wrapped so a Shopify failure never blocks the VeloDealer action — it records `last_error` on the listing instead.
- Frontend: `src/components/settings/ShopifyIntegration.tsx`, a `ShopifyListingCard` on `BikeDetailView.tsx`, and a `src/services/shopify.ts` client.
