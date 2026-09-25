# eBay live (production) + per-dealership switch

## What you'll get

- In Settings → Integrations → eBay, each dealership sees a **Test / Live** switch.
- Each mode has its own eBay sign-in. Connecting Live doesn't disconnect Test, so you can flip back and forth without signing in again.
- A clear badge ("eBay: Live" in green, "eBay: Test" in amber) on the eBay card and the Listings page, so nobody lists to the wrong site by mistake.
- Switching to Live asks for confirmation. Existing test listings stay on the test site and are marked as test; they aren't moved over.
- Business policies (postage, payment, returns) load from whichever mode is active.
- Automatic listing stays paused.

## One thing I need from you

eBay issues a separate "RuName" (redirect name) for the live keyset. I'll ask for it in a secure form: eBay Developer portal → your **Production** keyset → User Tokens → "Get a Token from eBay via Your Application" → the RuName, with the accept URL set to `https://api.velodealer.com/functions/v1/ebay-oauth`.

## Technical details

- Today every eBay call uses `EBAY_CLIENT_ID/SECRET/RU_NAME` (sandbox keyset) even when `environment='production'`, so live sign-in would fail. Add a shared `ebayCredentials(env)` in `_shared/ebay.ts` returning the prod set (`EBAY_PROD_CLIENT_ID/SECRET`, new `EBAY_PROD_RU_NAME`) or the sandbox set; use it in `basicAuth`, code exchange, refresh, and the authorize URL in `ebay-oauth`.
- Settings storage: keep `environment` as the active mode, and move tokens into per-mode slots (`tokens.sandbox`, `tokens.production`: access/refresh/expiry, seller username, policy IDs). Existing tokens migrate into `tokens.sandbox` on first read (in code, no migration).
- `requireConnection` reads the active mode's slot; errors say which mode needs reconnecting.
- `ebay-oauth` gains a `switch` action (admin/owner only, validated) that sets the active mode; `start` takes the mode to connect; disconnect clears only that mode.
- Listings record the mode they were created in (`ebay_listings` gets a nullable `environment` column, existing rows backfilled as `sandbox`); sync/end/revise use the listing's own mode, and the Listings page only counts listings for the active mode as "live on eBay".
- UI: `src/services/ebay.ts` + eBay settings card get the switch, per-mode connection status and badges.
- Verify: deploy, check the live authorize URL is built with the prod client id + RuName, sandbox still works, switch round-trips.