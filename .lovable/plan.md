# Move all API, edge function and storage traffic to api.velodealer.com

api.velodealer.com is already live and pointing at the VeloDealer backend (I checked — it answers correctly), so this is a switch-over rather than new setup.

## What changes in the app

1. The app itself (sign in, all data reads/writes, file uploads and downloads) talks to `https://api.velodealer.com` instead of the old supabase.co address.
2. The one hard-coded address in the app — the Cycle Courier webhook address shown in Settings — becomes the new one.
3. Every address the backend hands out to outside services (sign-in return addresses and webhook addresses for QuickBooks, Typeform, Shopify, eBay, Cycle Courier, InspectABike) is built from a single new setting. That setting will be `https://api.velodealer.com/functions/v1`; if it is ever unset, the old address is used so nothing breaks.

Existing photo links already saved in the database still contain the old address. They keep working (both addresses serve the same files), so they are left alone.

## What you need to change in the outside services

These are configured in each provider's dashboard and cannot be changed from here. Replace `https://hgztcymscgyuekgsyyfe.supabase.co/functions/v1/...` with `https://api.velodealer.com/functions/v1/...` everywhere below.

- QuickBooks (Intuit developer portal): Redirect URI → `.../quickbooks-oauth`. Keep the Connect/Disconnect URLs as your website address.
- Shopify (Partner Dashboard): App URL → `.../shopify-install`; allowed redirection URL → `.../shopify-oauth`; all three privacy/compliance webhook fields → `.../shopify-compliance`.
- eBay (developer portal): the RuName's accepted URL → `.../ebay-oauth`; marketplace account deletion endpoint → `.../ebay-notifications`.
- Typeform: nothing to do by hand — webhooks re-register themselves with the new address the next time a form is connected or re-saved. Existing forms should be re-saved once.
- Cycle Courier Co: webhook address → `.../cycle-courier-webhook`.
- InspectABike: webhook address → `.../inspectabike-webhook`.
- Resend: nothing to change.

Old addresses keep working during the switch, so there is no rush and no downtime; update them at your convenience.

## Technical notes

- `.env`: `VITE_SUPABASE_URL=https://api.velodealer.com`; `src/integrations/supabase/client.ts` `SUPABASE_URL` updated to match. That file is auto-generated, so if the platform regenerates it the value may revert — worth re-checking after any backend reconnection.
- New secret `PUBLIC_FUNCTIONS_BASE_URL = https://api.velodealer.com/functions/v1`, consumed by the redirect/webhook builders in `_shared/quickbooks.ts`, `_shared/typeform.ts`, `_shared/shopify.ts`, `_shared/ebay.ts`, and by `shopify-install`/`shopify-compliance`; each falls back to `${SUPABASE_URL}/functions/v1`.
- `src/services/integrations.ts:138` hard-coded webhook URL updated.
- Redeploy the affected functions; Supabase auth redirect/site URLs in the Supabase dashboard should also list the new host.
