# Connect each dealer's own InspectABike account

Today VeloDealer talks to InspectABike with one shared API key and one shared webhook secret, so every dealer on the platform effectively uses the same InspectABike account. This plan replaces that with a per-dealer sign-in, creates inspections automatically, and keeps faults in sync per dealer.

## What the dealer will see

1. Settings, Integrations, InspectABike: a **Connect** button. It takes them to InspectABike, they sign in and approve, and they come back to a "Connected as <account>" card with a Disconnect button.
2. Once connected, the moment a bike reaches the **Inspection** stage, an inspection is created on that dealer's InspectABike account automatically, with a link to the report on the bike page. No manual "Create inspection" step needed (the manual button stays as a fallback / retry).
3. Faults flow back automatically through the webhook, into the Repairs and Inspection pages exactly as they do now.
4. If the connection expires or is revoked, the card shows "Reconnect needed" and inspections queue with a clear message instead of silently failing.

## Important dependency

The InspectABike app (bike-checker-pro) must expose the dealer sign-in endpoints. The public docs page did not render its content for me, so this plan assumes the standard set below; if InspectABike already publishes different paths I will match them instead.

Required on the InspectABike side:

- `GET /oauth/authorize` — dealer login + approval screen, PKCE (S256), `client_id`, `redirect_uri`, `state`, `scope`, `code_challenge`.
- `POST /oauth/token` — exchanges the code, and refresh tokens; returns `access_token`, `refresh_token`, `expires_in`, plus the account name/id.
- All partner endpoints accepting `Authorization: Bearer <access_token>` as an alternative to `x-api-key`: `/partner-create-inspection`, `/partner-inspection`, `/partner-fault-decision`.
- Per-connection webhook: on connect, InspectABike stores the dealer's callback URL and a **per-connection signing secret**, returned once in the token response (or fetchable via `GET /partner-webhook`). Events unchanged: `fault.created|updated|repaired|deleted`, `inspection.faults_completed`, still signed as hex HMAC-SHA256 of the raw body in `x-inspectabike-signature`.
- Redirect URI to register for VeloDealer: `https://api.velodealer.com/functions/v1/inspectabike-oauth`

## Technical plan (VeloDealer side)

Mirrors the Cycle Courier OAuth pattern already in the project.

**Database**
- `inspectabike_connections`: `business_id` (unique, FK businesses), `access_token`, `refresh_token`, `access_token_expires_at`, `account_name`, `external_account_id`, `webhook_secret`, `status`, `last_error`, `connected_at`, timestamps. RLS: members of the business read; service role writes. Grants as per project convention.
- `inspectabike_oauth_states`: `state` pk, `business_id`, `user_id`, `code_verifier`, `origin`, `created_at`.

**Secrets**
- `INSPECTABIKE_CLIENT_ID`, `INSPECTABIKE_CLIENT_SECRET` (requested via the secure form once InspectABike issues them).
- Existing `INSPECTABIKE_API_KEY` / `INSPECTABIKE_WEBHOOK_SECRET` stay as a fallback for the current Broximo connection until it is re-connected, then can be removed.

**Edge functions**
- New `inspectabike-oauth` (`verify_jwt = false`): actions `status`, `auth_url`, `disconnect`, plus the OAuth callback. PKCE verifier stored in the states table, state verified on return, tokens saved against the caller's business.
- `_shared/inspectabike.ts`: `iabFetch(supabase, businessId, path, init)` — loads the business connection, refreshes the access token when expired or within 60s of expiry, retries once on 401, marks the connection `needs_reconnect` on invalid_grant, falls back to the shared API key only when no connection row exists. All call sites (`inspectabike-create`, `-sync`, `-decision`, `-undo-decision`, `-complete-repair`, `-backfill`) pass the bike/inspection `business_id`.
- `inspectabike-webhook`: resolve the local inspection first, then verify the signature against that business's `webhook_secret`, falling back to the env secret. Unknown/failed signature still returns 401.
- New `inspectabike-ensure-inspection` logic: reuse `inspectabike-create`, but called automatically.

**Automatic inspection at the Inspection stage**
- Client-side hook in the places a bike becomes `inspection` (`AdvanceStageDialog`, `AdminStatusSelect`, intake completion): fire-and-forget invoke of `inspectabike-create` when no `external_inspection_id` exists yet, quietly ignored when the business is not connected.
- Plus a safety net inside `inspectabike-create`: idempotent on the bike's reference, so repeat calls never create duplicates (already the behaviour).

**Frontend**
- New `src/components/settings/InspectABikeIntegration.tsx` (Connect / Connected / Reconnect / Disconnect, webhook URL shown, report base URL setting retained), rendered in Settings, Integrations above the existing backfill card.
- `src/services/inspectabike.ts` wrapping the status/auth_url/disconnect calls; `?inspectabike=connected|error` toast handling on return.

## Out of scope

- Migrating historic inspections between accounts; existing records keep working against whichever account created them.
- Any change to fault pricing, which InspectABike continues to own.
