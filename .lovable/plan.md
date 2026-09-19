# Pass Shopify's mandatory compliance webhook checks

Shopify's automated review is failing two checks: "Provides mandatory compliance webhooks" and "Verifies webhooks with HMAC signatures". The endpoint that answers those requests already exists in the app; what's missing is the declaration on Shopify's side, plus two fixes so the endpoint behaves correctly for every store.

## What you do in the Shopify Partner Dashboard

Open your app's configuration and set all three compliance fields to the same address:

```text
https://api.velodealer.com/functions/v1/shopify-compliance
```

- Customer data request endpoint
- Customer data erasure endpoint
- Shop data erasure endpoint

Save, then press "Run" on the automated checks again. These three fields can only be set here — they cannot be registered from the app.

## What I change in the app

1. Fix a fault that appears once more than one dealer has connected a store: the erasure handler looks up "the" connected store instead of the one named in the request, which errors out when several stores exist. It will match on the store address Shopify sends.
2. Make the shop erasure clear the listings and connection for that exact store only.
3. Keep the immediate signed/unsigned behaviour Shopify tests for: a correctly signed request gets a fast success reply, an unsigned or wrongly signed request is refused. I'll confirm both by sending test requests to the live endpoint.

## Verification

- Signed test request for each of the three topics: expect a fast success reply and a logged entry.
- Deliberately wrong signature: expect a refusal.
- Then re-run Shopify's automated checks.

## Technical notes

- `_shared/shopify.ts`: add `loadIntegrationByShop(supabase, shopDomain)` filtering `integrations` on `name = 'shopify'` and `settings->>shop_domain`, returning the single matching row (the current `loadIntegration` `.maybeSingle()` errors with multiple tenant rows).
- `supabase/functions/shopify-compliance/index.ts`: `disconnectShop` uses the new lookup; unchanged 401-on-bad-HMAC path, `EdgeRuntime.waitUntil` background handling, and `shopify_compliance_events` audit insert.
- No config.toml change — `shopify-compliance` already has `verify_jwt = false`.
- Redeploy `shopify-compliance` and curl it with a valid and an invalid HMAC to confirm 200 / 401.
