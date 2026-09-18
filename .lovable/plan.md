# Connect with Cycle Courier (OAuth)

Replace the typed API key with a proper "Connect with Cycle Courier" button. Each business connects its own Cycle Courier account once, approves VeloDealer, and bookings then go out on that account.

## What you'll see

- In Settings → Integrations, the Cycle Courier card loses the API key box and gains a **Connect Cycle Courier account** button.
- Clicking it opens Cycle Courier's approval page; after approving you land back in Settings with the card showing **Connected**, the account name and when it was connected.
- A **Disconnect** button ends the connection on both sides.
- The BPS delivery address fields and the webhook URL box stay exactly as they are.
- If a connection is ever revoked, collection and delivery bookings fail with a clear "Reconnect Cycle Courier" message instead of a silent error, and the card shows a reconnect prompt.

## What you need to do

Cycle Courier hasn't registered VeloDealer yet. Email Info@cyclecourierco.com and ask them to register the app with this return address:

```text
https://api.velodealer.com/functions/v1/cycle-courier-oauth
```

They will send back an App ID and an App secret. Once you have them I'll ask you to save them securely — until then the Connect button will show "not configured yet".

## Technical detail

**Secrets:** `CYCLE_COURIER_CLIENT_ID`, `CYCLE_COURIER_CLIENT_SECRET` (requested via the secure form after Cycle Courier responds).

**Database migration** — new table `cycle_courier_connections`, one row per business:
`id`, `business_id` (unique, default `current_business_id()`), `access_token`, `refresh_token`, `access_token_expires_at`, `account_name`, `status` (`connected` / `needs_reconnect`), `last_error`, `connected_at`, `updated_at`. Grants to `authenticated` (select only) and `service_role` (all); RLS `tenant_scope` mirroring the other tenant tables. Tokens are never exposed to the browser — the select policy is used only for status display, so the service role writes and the client reads through a view-safe service call instead of selecting token columns directly (client reads go through the edge function).

Also a short-lived `cycle_courier_oauth_states` table (`state` pk, `business_id`, `user_id`, `code_verifier`, `created_at`) for PKCE, rows older than 10 minutes purged on each use.

**New edge function `supabase/functions/cycle-courier-oauth/index.ts`** (`verify_jwt = false` in `config.toml`, JWT validated in code for the POST actions):
- `POST { action: 'status' }` — returns connected / account name / needs_reconnect, no tokens.
- `POST { action: 'auth_url' }` — admin/owner only; generates `code_verifier` + S256 challenge + `state`, stores them, returns the `https://booking.cyclecourierco.com/oauth/authorize` URL.
- `GET ?code=&state=` — the registered redirect. Verifies state, exchanges at `POST https://api.cyclecourierco.com/functions/v1/oauth-token` with `code_verifier` and client credentials, stores the tokens against the state's business, 302s back to `/settings?cyclecourier=connected` (or `=error`). Handles `?error=access_denied`.
- `POST { action: 'disconnect' }` — calls `/oauth-revoke` with the refresh token, then deletes the row.

**New shared helper `supabase/functions/_shared/cycle-courier.ts`:**
- `getAccessToken(supabase, businessId)` — returns a valid bearer token, refreshing via `grant_type=refresh_token` when the token expires within 60 seconds and persisting the rotated refresh token immediately; a single serialised refresh per row (conditional update on the stored refresh token) so two bookings never refresh in parallel.
- On `invalid_grant` or a 401 from the API: set `status = 'needs_reconnect'`, record `last_error`, and throw a `ReconnectRequired` error — no retry loop.
- `cycleCourierFetch(supabase, businessId, path, init)` — adds `Authorization: Bearer …`, retries once after a refresh on a first 401.

**Callers updated** — `create-collection-order` and `create-delivery-order` drop `integration.api_key` / `X-API-Key` and use `cycleCourierFetch(..., '/orders', …)` with the bike's `business_id`; when no connection exists they return a clear "Connect Cycle Courier in Settings" error and mark the collection row failed as they do today.

**Frontend** — `src/services/integrations.ts` gains `getCycleCourierStatus`, `getCycleCourierAuthUrl`, `disconnectCycleCourier` (all through the edge function); the API key save path and `testCycleCourierConnection` / the `test-cycle-courier` function are removed. `CycleCourierIntegration.tsx` drops the API key field and Test Connection, adds Connect / Disconnect and the reconnect notice, keeps the webhook secret, BPS address and webhook URL sections, and reads `?cyclecourier=` on load to show a success or error toast. The webhook secret continues to live on the existing `integrations` row.

**Out of scope:** the inbound webhook (`cycle-courier-webhook`) is unchanged — it stays HMAC-verified with the webhook secret.
