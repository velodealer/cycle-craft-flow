# QuickBooks security assessment — close the gaps

The Intuit app assessment asks about token refresh, retries, reconnect prompts and CSRF
protection. Most answers are already "Yes"; three gaps need small fixes so every answer
can be Yes.

## What changes

1. **CSRF / state validation (question 6d)**
   - When generating the QuickBooks auth URL, store the random `state` value in the
     integration settings.
   - In the OAuth callback, reject the request if the returned `state` doesn't match the
     stored value. This is the standard CSRF defence Intuit asks about.

2. **Automatic retry of failed token refreshes (question 3)**
   - If a token refresh or QuickBooks API call fails with a transient error (network
     error or 5xx), retry once after a short delay before giving up.
   - If a QuickBooks API call returns 401 with a fresh-looking token, force one refresh
     and retry the call once.

3. **Clear reconnect prompt on unrecoverable auth errors (questions 4, 6b, 6c)**
   - When a refresh fails with `invalid_grant` (expired/revoked refresh token), mark the
     integration as needing reconnection.
   - The QuickBooks settings card then shows a clear "Connection expired — please
     reconnect" message with the Connect button, instead of a raw error.

## Technical details

- `supabase/functions/quickbooks-oauth/index.ts` — save `oauth_state` in settings in
  `auth_url`; validate `state` against it in the GET callback and clear it after use;
  on `invalid_grant` from the token endpoint, set `settings.auth_error` and
  `is_active = false`.
- `supabase/functions/_shared/quickbooks.ts` — add single-retry-with-backoff around
  `refreshAccessToken`; in `getQboAuth`/`qboFetch`, on 401 force one token refresh and
  retry the request once; on `invalid_grant` throw a typed error so callers can show
  the reconnect state.
- `src/components/settings/QuickBooksIntegration.tsx` (or equivalent card) — read the
  `auth_error` flag from the status action and render the "please reconnect" prompt.
- No database schema changes; only settings JSON keys added.
- Redeploy `quickbooks-oauth`, `quickbooks-sync-invoice`, `quickbooks-sync-purchase`
  (they share the helper).

## After this lands — form answers

1. Tested connect/disconnect/reconnect — Yes
2. Refresh frequency — Automatically before every API call when the token is expired
   or near expiry
3. Retries failed auth requests — Yes
4. Asks customers to reconnect on auth errors — Yes
5. Discovery document — No (stable Intuit endpoints used directly)
6. a Yes, b Yes, c Yes, d Yes
7. OAuth playground reliance — No
