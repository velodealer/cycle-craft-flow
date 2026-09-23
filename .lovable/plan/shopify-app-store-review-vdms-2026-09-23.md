# Shopify App Store review: VDMS

The Shopify AI Toolkit's review command only runs in a coding assistant on your own computer, so this review was done by hand against Shopify's App Store requirements.

## Already passing
- Install starts on Shopify. The App URL points at the install page, which checks Shopify's signature and goes straight to the permission screen.
- The three privacy webhooks point at VeloDealer and check Shopify's signature (bad signature gets refused).
- Only the correct return address is listed.
- It asks only for the permissions it uses: products, inventory, orders (read-only) and locations (read-only).
- There's no billing to review, because the app is free.

## Gaps to fix
1. **Uninstall webhook isn't in the app setup.** Every time we release from here, the whole app setup gets replaced. That could wipe an uninstall webhook added in the dashboard. Fix: add `app/uninstalled` to the app setup, pointing at the existing Shopify webhook address. That address then turns off the store's connection and deletes its access key.
2. **The security check on install is only half done.** A random code is created when install starts, but it's never checked when the merchant comes back. Fix: save the code when install starts, then check it once on return and reject it if it's missing, already used or out of date.
3. **Store address isn't checked.** Fix: accept only real `*.myshopify.com` addresses on install and on return.
4. **Release and re-check.** Release the app as a new version (vdms-6) and check that the uninstall webhook and privacy webhooks respond correctly.

## What you still do in the Partner Dashboard
- Listing text, screenshots, support email, privacy policy link (velodealer.com/privacy) and the demo video.
- Give Shopify's reviewers a test login and step-by-step notes.
- Re-run the automated checks, then submit.

## Technical details
- shopify.app.toml: add a `[[webhooks.subscriptions]]` entry with `topics = ["app/uninstalled"]` and `uri = ".../shopify-webhook"`. shopify-webhook must handle that topic: verify the HMAC, mark the integration inactive and null the token. Remove the stale comment in shopify-oauth.
- New table `shopify_oauth_states` (state PK, shop, created_at). Only the service role can touch it: grants plus RLS with no public policies. shopify-install inserts the state. The shopify-oauth callback deletes it and requires the delete to return a row created within the last 10 minutes.
- Shop regex `^[a-z0-9][a-z0-9-]*\.myshopify\.com$`, checked in both functions.
- Deploy the functions, then run `npx @shopify/cli@latest app deploy --client-id ... --force`.
