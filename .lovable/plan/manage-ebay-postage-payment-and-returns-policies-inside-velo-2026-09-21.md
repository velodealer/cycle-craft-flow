# Manage eBay postage, payment and returns policies inside VeloDealer

Today the eBay card can only pick from policies already created on eBay's own site. This adds full management: create, edit and delete each type of policy without leaving VeloDealer.

## What the dealer gets

On the eBay card in Settings, each of the three policy pickers gains:

- a **New** button, opening a form to create a policy
- an **Edit** button next to the chosen policy
- a **Delete** option inside the edit form, with a confirmation step

After saving, the list refreshes and the new policy is selected automatically.

### Postage form
- Policy name and optional description
- Handling time (same day, 1, 2, 3, 5 working days)
- Postage service (UK courier options from eBay's list), plus cost or "free postage"
- Optional "buyer collects in person" toggle for bikes picked up from the shop

### Payment form
- Policy name and optional description
- Immediate payment required on or off

### Returns form
- Policy name and optional description
- Returns accepted or not
- Return window: 14, 30 or 60 days
- Who pays return postage: buyer or seller
- Refund method: money back or money back / replacement

All three are scoped to the dealership's own connected eBay account, like the rest of the integration.

## Errors

eBay rejects invalid combinations with detailed messages (for example a policy name already in use, or a postage service not valid for the marketplace). These are shown in plain English on the form, and the form stays open so the dealer can correct it. A policy still in use by a live listing cannot be deleted — that message is passed through too.

## Technical notes

- `supabase/functions/ebay-oauth/index.ts` gains actions `save_policy` and `delete_policy`, plus an extended `policies` action that returns the full policy objects (not just id and name) so the edit forms can be pre-filled. All use the existing `requireConnection(supabase, businessId)`, so the calls run against the dealership's own eBay account with `admin`/`owner` role checks unchanged.
- Calls hit Sell Account API v1: `POST/PUT/DELETE /sell/account/v1/fulfillment_policy[/{id}]`, `.../payment_policy[/{id}]`, `.../return_policy[/{id}]`, with `marketplaceId` from the stored settings (default `EBAY_GB`) and `categoryTypes: [{ name: 'ALL_EXCLUDING_MOTORS_VEHICLES' }]`.
- A new action `shipping_services` proxies `GET /sell/metadata/v1/marketplace/{id}/get_shipping_service_rate_tables` fallback: the service list comes from eBay's marketplace metadata; if it is unavailable, a small built-in list of common UK services is used so the form still works.
- Request bodies are validated server-side (name length, numeric costs, allowed enum values) before being sent on; eBay error payloads are unwrapped to the first `message`/`longMessage` and returned as a 400.
- `src/services/ebay.ts` gains `saveEbayPolicy`, `deleteEbayPolicy`, `getEbayShippingServices`, and `getEbayPolicies` returns the richer shape.
- New component `src/components/settings/EbayPolicyDialog.tsx` holds the three forms (one dialog, switched by policy kind) using existing shadcn form primitives and the trade-desk styling; `EbayIntegration.tsx` wires up the New/Edit buttons and refreshes the lists.
- No database changes. Redeploy `ebay-oauth`.
