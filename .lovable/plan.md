# Make the Shopify app installable by other dealers

You chose public distribution, so the app must meet Shopify's requirements for apps that any store can install. Two parts: settings you set in Shopify, and privacy endpoints I add in VeloDealer.

## What you do in Shopify

1. Partners dashboard → the VDMS app → Distribution → choose **Public distribution** and save (permanent choice).
2. Configuration → Allowed redirection URL must be exactly:
   `https://hgztcymscgyuekgsyyfe.supabase.co/functions/v1/shopify-oauth`
3. Un-tick "Embed app in Shopify admin".
4. App URL: your VeloDealer address.

Once distribution is set, installs stop being blocked and you can install on your own store straight away while the public listing is still unreviewed.

## What I add

Shopify requires every public app to answer three mandatory privacy webhooks. Without them, installs work but the app can never pass review.

- A new endpoint that handles `customers/data_request`, `customers/redact` and `shop/redact`, verifying Shopify's signature and replying 200.
- `shop/redact` also clears that store's saved connection and listing records from VeloDealer.
- `app/uninstalled` handling so a store that removes the app is disconnected here automatically.
- Register these in the app's configuration URLs list for you to paste in.

## Technical notes

- New function `supabase/functions/shopify-compliance/index.ts`, `verify_jwt = false`, HMAC-SHA256 of the raw body against `SHOPIFY_CLIENT_SECRET` (falling back to `SHOPIFY_WEBHOOK_SECRET`), constant-time compare, 401 on mismatch.
- `shop/redact` and `app/uninstalled` delete the matching row in `integrations` for that shop domain and null out `shopify_listings` product references for bikes belonging to it.
- Extend the webhook registration in `shopify-oauth` to also subscribe to `app/uninstalled`.
- No schema change required.
