# eBay: one connection per dealership (and why reconnect skips the eBay screen)

## Part 1 — Why pressing Connect again doesn't show eBay

The Disconnect button does work: it clears the stored eBay tokens and switches the connection off, which is why the card flips to "Not connected".

What it cannot do is remove the permission on eBay's side. Once a seller approves the app, eBay remembers that approval against their eBay account, so the next Connect is waved through silently and bounces straight back — often too fast to see the eBay page. The connection really is re-made; eBay just never asks again.

Changes:
- Ask eBay to always show the sign-in/approval step when Connect is pressed, so the seller can confirm or switch accounts.
- After disconnecting, show a short note on the card explaining the tokens are cleared here and that removing the permission on eBay itself is done in their eBay account's third-party app access page, with a link to it.

## Part 2 — Connect eBay per dealership

Today every dealership shares one eBay connection record. The connection settings are looked up by name only, with no dealership filter, so a second dealership connecting would overwrite the first one's tokens, and the lookup itself fails once two records exist. Cycle Courier and InspectABike are already per-dealership; eBay needs the same treatment.

What changes for dealers:
- Each dealership connects its own eBay seller account and sees only its own status, seller name, policies, categories and auto-listing settings.
- A dealership's listings are always created on and ended from its own eBay account.
- Disconnecting affects only that dealership.

## Technical notes

Storage: keep using `public.integrations` with `name = 'ebay'`, scoped by `business_id` (the existing row already carries one, and only one dealership is connected today, so no data migration is needed). Add a unique constraint on `(name, business_id)` so a dealership can never end up with two eBay records.

`supabase/functions/_shared/ebay.ts`:
- `loadIntegration`, `loadSettings`, `saveSettings`, `requireConnection` take a `businessId` and filter/insert on it; `saveSettings` inserts with `business_id` set.
- Add `businessIdForUser(supabase, userId)` (read `profiles.business_id`) and `businessIdForBike(supabase, bikeId)`.

`supabase/functions/ebay-oauth/index.ts`:
- Every authenticated action resolves the caller's `business_id` first and passes it down (status, auth_url, save_settings, policies, categories, disconnect).
- The OAuth callback is unauthenticated, so the dealership must survive the round trip: create `public.ebay_oauth_states` (state text PK, business_id, user_id, environment, origin, created_at) matching the Cycle Courier pattern, with super-admin-free RLS (service role only), written when the auth URL is built and consumed and deleted in the callback. Reject unknown or expired (>15 min) states.
- `auth_url` also gains `prompt=login` (Part 1).

`supabase/functions/_shared/ebay-listing.ts`: `pushBikeToEbay`, `endEbayListing`, `deleteEbayListing` resolve the bike's `business_id` and pass it to `requireConnection`, so a bike is always listed under its own dealership's account. `ebay_listings` already stores `business_id`.

`supabase/functions/ebay-sync-bike/index.ts`: unchanged apart from the helpers now being dealership-aware; add a guard that the caller's business matches the bike's.

`ebay-notifications` stays global — it is eBay's account-deletion handshake and stores nothing.

Frontend: no change needed; `src/services/ebay.ts` and the settings card already call the function and get back whatever the caller's dealership has.

Redeploy `ebay-oauth` and `ebay-sync-bike`.
