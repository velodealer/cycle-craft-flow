# eBay live sign-in: redirect settings and OAuth audit

## What to enter in eBay (Production → User Tokens → your live RuName)

- **Auth Accepted URL:** `https://api.velodealer.com/functions/v1/ebay-oauth`
- **Auth Declined URL:** `https://api.velodealer.com/functions/v1/ebay-oauth?declined=1`
- **OAuth enabled:** yes (not "Auth'n'Auth")
- **Privacy policy URL:** `https://velodealer.com/privacy`

The Accepted URL works now. The Declined URL needs fix 1 below. Until then, anyone who presses "Don't agree" on eBay gets an error page instead of going back to Settings.

## Audit findings (checked against eBay's authorization guide)

Already done right:
- Uses the authorization-code flow, and the code is exchanged on the server. The client secret never reaches the browser.
- Each sign-in gets a single-use `state` that is saved on the server, expires after 15 minutes and is deleted once used. This protects against forged sign-ins.
- `prompt=login` makes eBay ask for the seller's login, so nobody connects the wrong eBay account by accident.
- Access tokens refresh automatically before they expire.
- Test and Live use separate keys, RuNames and token slots.
- Missing scopes are detected, and the app asks the seller to reconnect.

Gaps to fix:
1. **Declined sign-ins aren't handled.** A plain return with no `code` or `error` falls through to the logged-in API and fails. Fix: treat `declined=1` (or any return from eBay with no code) as "cancelled" and send the seller back to Settings with a friendly message.
2. **The return address can be changed from the browser.** The app address comes from the browser and is used for the final redirect, which means someone could redirect to another site. Fix: only allow velodealer.com, its subdomains, and the Lovable preview/published addresses. Anything else goes to velodealer.com.
3. **The state value includes the app address in plain text.** Fix: make the state a random value only, and look up the address and environment from the saved record. Remove the state-parsing fallbacks.
4. **The callback may check the wrong site.** Right after connecting, the "read eBay account name" step uses the currently active mode, not the mode just connected. Fix: pass the connected environment into `requireConnection` and `saveSettings`, so a Live connect always fills the Live slot.
5. **The refresh token's expiry date isn't stored.** It lasts about 18 months. Fix: store `refresh_token_expires_at` and show "Reconnect eBay before <date>" 30 days ahead.
6. **A revoked refresh token isn't recognised.** When eBay returns `invalid_grant`, mark that mode as needing reconnection and show a clear message, instead of a generic error at listing time.
7. **Where tokens are stored.** Confirm that only the server can read the eBay tokens stored with the integration settings. Staff browsers must never be able to. If the check shows browsers can read them, move the tokens to a server-only table.
8. **Disconnecting doesn't sign you out at eBay.** eBay has no public revoke endpoint for user tokens. Fix: tokens are already cleared locally; after disconnecting, add a note with a link to eBay's "Third-party app permissions" page.
9. **Scopes.** Check each requested scope against what the app actually uses (inventory, account, fulfillment, marketing, identity) and drop any that aren't needed.

## Technical details

- Files: `supabase/functions/ebay-oauth/index.ts` (callback branch, `auth_url`, `safeOrigin`/`envFromState` removal, origin allowlist), `supabase/functions/_shared/ebay.ts` (store `refresh_token_expires_in`, `invalid_grant` → `needs_reconnect`, mode-aware `requireConnection`), `src/components/settings/EbayIntegration.tsx` (cancelled/expiry messages, eBay permissions link).
- Add a Deno test for the origin allowlist and for declined-callback handling.
- Verify with curl: `?declined=1` → 302 to `/settings?ebay=cancelled`; forged origin → redirect to velodealer.com; then a live sign-in.
