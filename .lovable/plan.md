# Fix eBay Live sign-in (invalid_request 400)

## What the error means
The 400 comes from eBay's own sign-in page, before any login is shown. eBay rejects the link when the details in it don't match a single production application. The usual causes, in order:

1. **The live RuName belongs to a different eBay application than the live App ID/Cert ID** — e.g. the sandbox RuName was pasted into the live slot, or the RuName comes from another keyset.
2. **The live RuName is typed differently** from what eBay shows (it is case- and hyphen-sensitive).
3. **The production keyset's "Auth Accepted URL" doesn't match** what the RuName expects, or OAuth isn't enabled on that RuName.
4. A requested permission (scope) isn't available to that application.

All four live secrets (App ID, Cert ID, RuName) are saved, so this is a mismatch, not a missing-setup issue.

## Steps

1. **Add diagnostics**: when the live sign-in link is built, log the environment, the RuName being used, and the client ID to the `ebay-oauth` function logs (these are not secret — they appear in the browser address bar anyway). Also return a clearer error if any live value is missing.
2. **Generate a live sign-in link** from the app and inspect it: confirm it uses the production App ID and the production RuName, and that the scope list is valid.
3. **You check the eBay developer portal** (Production keyset → User Tokens):
   - the RuName shown there is copied exactly into VeloDealer's live RuName (I'll open the secure form so you can re-enter it);
   - that RuName sits under the **same production keyset** as the App ID/Cert ID already saved;
   - Auth Accepted URL is `https://api.velodealer.com/functions/v1/ebay-oauth`, Auth Declined URL is the same with `?declined=1`, and OAuth (not Auth'n'Auth) is enabled.
4. **Retry the live sign-in** and confirm you reach eBay's login/consent page and land back in Settings connected.

## Technical details
- Files: `supabase/functions/ebay-oauth/index.ts` (auth_url logging + clearer errors), no database changes.
- Secrets touched: `EBAY_PROD_RU_NAME` re-entry via secure form only if step 3 shows a mismatch; App ID/Cert ID only if they turn out to be from the wrong keyset.
- Sandbox sign-in is unaffected.
