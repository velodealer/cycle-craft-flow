# Shopify privacy compliance webhooks

Shopify is asking for the three mandatory privacy webhooks. The endpoint that handles them already exists in the app — what's missing is the configuration on Shopify's side, plus a few hardening touches so it passes Shopify's automated check.

## What you do in the Shopify Partner Dashboard

In your app's configuration, set all three compliance webhook fields to the same address:

```text
https://hgztcymscgyuekgsyyfe.supabase.co/functions/v1/shopify-compliance
```

- Customer data request endpoint
- Customer data erasure endpoint
- Shop data erasure endpoint

These three can only be set here — they cannot be registered automatically from the app.

## What I change in the app

1. Reply to Shopify immediately with a success response, then do the clean-up work in the background. Shopify fails apps that take too long to answer.
2. Stop trying to register `app/uninstalled` through the API at connect time and rely on the app configuration instead, so there are no duplicate or rejected registrations.
3. Record every compliance request received (topic, store, time, outcome) so you have an audit trail if Shopify or a customer asks.
4. Broaden the customer erasure step so it also clears matching contact details on sale records, not just the owner record.
5. Return a clear rejection when the signature doesn't match, which is exactly what Shopify's automated test checks for.

## Verification

- Send a correctly signed test request for each of the three topics and confirm a fast success reply.
- Send a deliberately wrong signature and confirm it is rejected.
- Confirm the store disconnect path still clears listings after a shop erasure.

## Technical notes

- `supabase/functions/shopify-compliance/index.ts`: respond before awaiting handlers (`EdgeRuntime.waitUntil`), add a `shopify_compliance_events` insert, extend `supabase_redactCustomer`.
- New migration for `shopify_compliance_events` (topic, shop_domain, payload_summary, handled_at) with admin/owner read policy and service-role write.
- `supabase/functions/shopify-oauth/index.ts`: drop `COMPLIANCE_TOPICS` from `registerWebhooks`.
- `supabase/config.toml` already has `verify_jwt = false` for `shopify-compliance`; no change needed.
