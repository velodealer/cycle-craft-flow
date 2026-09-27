# Project architecture rules

- Keep eBay notification public-key normalization and raw-body signature verification in the shared notification helper so endpoint behavior and regression tests use the same cryptographic path.
- Browsers never read provider credentials: `integrations` exposes only non-secret columns to signed-in users, settings come through `get_integration_settings` (secrets stripped), and token-bearing connection tables are service-role only — so one dealership can never see another's sign-ins.
- Workshop flow is bike-gated: Repairs is the admin/owner decision queue; every approved fault creates one idempotently linked workshop job (including zero-cost work), and Jobs becomes visible to admin/mechanics only after every inspection fault on that bike is decided.
- Marketplace images use ordered `bikes.listing_photos`; eBay and Shopify fall back to `bikes.photos` only when the listing set is empty, preserving existing listings.
- eBay payloads keep Brand only in item specifics and never send product.brand, product.mpn, or an MPN item specific: eBay treats product.brand as an incomplete BrandMPN catalogue pair, while MPN is only recommended for category 177831; bikes.mpn stays internal-only.
- Channel mark-ups and manual CSV toggles live in `app_settings` under key `listing_channels:<business_id>` (app_settings is keyed by `key` only), with identical pricing logic in `src/lib/channelPricing.ts` and `_shared/channel-pricing.ts` so exports and live listings price the same.
- Deferred workshop jobs (`jobs.deferred`, owner/admin only via DB trigger, reason required) never block Ready/Listed but always block handover: create-delivery-order returns 409 unless an owner/admin gives an override reason, logged in bike_activity.
