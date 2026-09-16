# Fix the five failing Shopify App Store requirements

Goal: pass Shopify's review checks for billing, API usage, and the install flow.

## 1. Billing (requirements 1.2.1, 1.2.2, 1.2.3)

Stores that install VeloDealer from the Shopify App Store get it free, so no Shopify charge is created. To make that unambiguous to reviewers:

- The Shopify listing is submitted as a free app (no pricing plans declared in the Partner Dashboard).
- The pricing page gains a short line stating that the Shopify App Store version is free to install and use, and that the paid plans apply only to customers who sign up directly with VeloDealer.
- No Billing API code is added. If paid Shopify plans are wanted later, that becomes a separate piece of work using Shopify's subscription billing.

## 2. Move the remaining REST calls to GraphQL (requirement 2.2.4)

The connect step still uses three REST endpoints. Replace them with the GraphQL equivalents:

- listing and creating webhooks -> `webhookSubscriptions` query and `webhookSubscriptionCreate` mutation
- shop name lookup -> `shop` query
- locations (both at connect time and in the Settings picker) -> `locations` query

The REST helper is then unused and gets removed, so nothing can slip back in.

## 3. Install starting from Shopify (requirements 2.3.1, 2.3.2, 2.3.3)

Today a merchant has to sign in to VeloDealer and type their store address. Shopify requires install to begin on Shopify's side.

New behaviour:

- A new public entry point accepts Shopify's install request (`?shop=...&hmac=...&timestamp=...`), checks the signature, and immediately sends the merchant to Shopify's permission screen. No sign-in required, no typed store address.
- After the merchant approves, the callback works as it does now, then decides where to land them:
  - already signed in to VeloDealer -> straight to Settings with the store connected
  - not signed in -> the signup page with the store address carried across, so the store is linked to their account as soon as they register or sign in
- The Settings card keeps a "Connect" button, but it no longer asks for a typed store address; it starts the same Shopify-side flow.

## 4. Remaining review notes (1.1.1, 2.2.3, 2.3.4)

- One store per VeloDealer account stays as-is; a reinstall simply replaces the stored token, which is the behaviour Shopify expects.
- The app is non-embedded on purpose, so App Bridge and session tokens do not apply. Confirm "Embed app in Shopify admin" is off in the Partner Dashboard.

## Technical notes

- New edge function `shopify-install` (`verify_jwt = false`) handling `GET /?shop=&hmac=&timestamp=&host=`: HMAC check over sorted query params with `SHOPIFY_CLIENT_SECRET`, `normaliseShopDomain`, nonce in `state`, 302 to `https://<shop>/admin/oauth/authorize`. This URL becomes the app's App URL in the Partner Dashboard.
- `_shared/shopify.ts`: drop `shopifyRest`, add `fetchShopName`, `fetchLocations`, `ensureWebhooks` built on `shopifyGraphql` (API version stays `2025-01`).
- `shopify-oauth`: `auth_url` action no longer takes a shop domain from the request body; callback redirect target chosen by whether a `state`-carried origin plus session exists, else `/auth?shopify=<shop>`.
- `src/components/settings/ShopifyIntegration.tsx`: remove the shop-domain input, keep disconnect/settings; add pending-connection handling on `/auth` so a post-signup user is linked to the shop.
- `src/pages/PricingPage.tsx`: add the free-on-Shopify note.
- Deploy `shopify-install` and `shopify-oauth`; re-run the self-review afterwards.
