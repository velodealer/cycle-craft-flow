# eBay listing integration

Connect an eBay seller account to VeloDealer so bikes are listed on eBay automatically when they're ready, with manual control to push or pull any listing.

## What you'll get

**Settings → Integrations → eBay**
- Connect button that sends you to eBay to sign in and approve, then returns showing the connected seller account.
- Environment switch: sandbox first, live later.
- Defaults chosen once: business policies (payment, postage, returns), default bicycle category, listing format (fixed price), condition, listing location/postcode, and quantity.
- Auto-list on/off, plus a Disconnect button.

**On each bike page — an eBay panel**
- List on eBay / Update listing / End listing buttons with the live link and current state.
- Shows last sync time and any error returned by eBay in plain language.

**Automatic behaviour**
- Bike reaches ready/listed → listed on eBay (when auto-list is on), using the eBay listing template already in Listing Formats for title and description.
- Bike sold here, sold on Shopify, broken for parts, delivered or deleted → eBay listing ended automatically.
- An eBay sale marks the bike sold in VeloDealer and raises the invoice, same as the Shopify order flow.

**Multi-dealer**
Each dealer connects their own eBay account, exactly like Shopify. You'll need one eBay developer application (sandbox keys now, production keys when you go live) that all dealers install.

## What you need to do

1. In the eBay developer portal, add this as the accepted redirect (RuName / auth accepted URL):
   `https://hgztcymscgyuekgsyyfe.supabase.co/functions/v1/ebay-oauth`
2. Give me the sandbox App ID (client ID), Cert ID (client secret) and RuName — I'll open a secure form for them.
3. Create your business policies in eBay Seller Hub (payment, postage, returns) if you haven't; they're required for listings.

## Technical detail

**Database** — new `ebay_listings` table mirroring `shopify_listings`: `bike_id`, `environment`, `offer_id`, `listing_id`, `sku`, `listing_url`, `status`, `quantity`, `last_synced_at`, `last_error`, timestamps; GRANTs for `authenticated`/`service_role`, RLS matching `shopify_listings`. Connection stored in `integrations` under name `ebay` (`settings` holds refresh token, expiry, seller user, marketplace, environment, defaults). Secrets: `EBAY_CLIENT_ID`, `EBAY_CLIENT_SECRET`, `EBAY_RU_NAME`, `EBAY_WEBHOOK_VERIFICATION_TOKEN`.

**Edge functions**
- `_shared/ebay.ts` — token exchange/refresh, environment-aware base URLs (`api.sandbox.ebay.com` / `api.ebay.com`), REST helper, settings load/save.
- `_shared/ebay-listing.ts` — Inventory API flow: `PUT /sell/inventory/v1/inventory_item/{sku}` (SKU = bike `reference`), `POST /sell/inventory/v1/offer`, `POST .../offer/{id}/publish`; update and `withdraw` for ending. Title/description built from the existing eBay listing template; images from bike photos.
- `ebay-oauth` — `auth_url`, callback (code → tokens, origin/state redirect to `/settings`), `status`, `save_settings`, `policies` (fetch business policies), `categories` (suggested category lookup), `disconnect`.
- `ebay-sync-bike` — actions `list`, `update`, `end`, called manually and from `syncEbayQuietly`.
- `ebay-notifications` — eBay marketplace account deletion endpoint (challenge-code SHA-256 response + POST handling) and sale notification handling; `verify_jwt = false` in `supabase/config.toml`.

**Frontend**
- `src/services/ebay.ts` mirroring `src/services/shopify.ts`, including `syncEbayQuietly`.
- `src/components/settings/EbayIntegration.tsx` added to `SettingsPage`.
- `src/components/bike/EbayListingCard.tsx` on the bike detail page.
- Quiet hooks alongside the existing Shopify calls in `AdvanceStageDialog`, `AdminStatusSelect`, `BreakBikeDialog`, `RecordSaleDialog`, `DeleteBikeDialog`.

Order of work: migration → secrets → shared helpers and functions → Settings card → bike card → status hooks.
