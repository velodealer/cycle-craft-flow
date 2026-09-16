# Shopify public distribution: what's needed, and where we stand

## Straight answer on your criteria list

The list you pasted is Shopify's **Built for Shopify** standard. VeloDealer does **not** meet it today, and most of it can't be met by small fixes — it describes a different kind of app.

- **Embedded in Shopify admin** — no. VeloDealer is your own dealer management system that merchants log into directly. Being embedded means the whole interface runs inside Shopify's admin in a frame, using Shopify's App Bridge and session tokens instead of your own sign-in.
- **No separate sign-up screens** — no. Staff sign in to VeloDealer with email and password; that's core to the product.
- **Theme app extensions / no Asset API** — not applicable, we add nothing to the storefront theme, which is fine.
- **Core Web Vitals in admin** — only measurable once embedded.
- **Shopify design guidelines** — VeloDealer uses its own design.

Important distinction: **Built for Shopify is optional.** It's a badge for apps listed in the Shopify App Store. You do not need it to distribute a public app that dealers install via a link, and you do not need it for the integration to work. If you want an App Store listing with the badge, VeloDealer would essentially need a second, embedded Shopify-admin front end — a large separate project.

## Recommended path

Ship the app as a public app installed by link (no App Store listing, no badge). That needs only the items below.

### What you do in Shopify

1. Partners dashboard → VDMS app → Distribution → **Public distribution**, save (permanent).
2. Configuration → Allowed redirection URL exactly:
   `https://hgztcymscgyuekgsyyfe.supabase.co/functions/v1/shopify-oauth`
3. Un-tick "Embed app in Shopify admin".
4. App URL: your VeloDealer address.

### What I add

Public apps must answer Shopify's three mandatory privacy webhooks, plus clean uninstall:

- New endpoint handling `customers/data_request`, `customers/redact`, `shop/redact` with signature verification and a fast 200.
- `shop/redact` and `app/uninstalled` clear that store's saved connection and listing links in VeloDealer.
- Subscribe to `app/uninstalled` during install.
- Give you the exact URLs to paste into the app's configuration.

## Technical notes

- New function `supabase/functions/shopify-compliance/index.ts`, `verify_jwt = false`, HMAC-SHA256 over the raw body against `SHOPIFY_CLIENT_SECRET` (fallback `SHOPIFY_WEBHOOK_SECRET`), constant-time compare, 401 on mismatch.
- Redact/uninstall handlers delete the matching `integrations` row for the shop domain and clear `shopify_listings` product references for that store's bikes.
- Extend webhook registration in `shopify-oauth` with `app/uninstalled`.
- No schema change required.

## Later, only if you want an App Store listing

A separate embedded Shopify admin surface: App Bridge on every page, session-token auth, Polaris-based UI, and performance tuning against Core Web Vitals. Worth planning as its own project once the integration is proven with real dealers.
