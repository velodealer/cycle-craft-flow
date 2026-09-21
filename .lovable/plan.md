# Why reconnecting eBay skips the eBay screen

## What is actually happening

The Disconnect button does work. It clears the stored eBay tokens and marks the connection inactive, which is why the card flips back to "Not connected".

What it cannot do is remove the permission on eBay's side. Once a seller has approved the app, eBay remembers that approval against their eBay account. So when Connect is pressed again, eBay sees an already-approved app and an already-signed-in seller, approves silently, and bounces straight back — often too fast to notice the eBay page at all. The connection is genuinely re-made; it just never asks again.

## What to change

1. Ask eBay to show the sign-in step every time the Connect button is used, so the seller can confirm (or switch accounts) instead of being waved through silently.
2. On disconnect, show a short note on the card explaining that the tokens have been cleared here, and that to remove the permission on eBay itself the seller signs in to eBay and removes the app under their account's third-party application access.
3. Add a "Revoke on eBay" link on that note pointing at the right eBay page for the environment in use (live or sandbox).

## Also worth knowing (separate issue)

The eBay connection is still stored as one shared record rather than one per dealership, unlike Cycle Courier and InspectABike. With more than one dealer connected, the lookup that expects a single record will fail. This is not the cause of the reconnect behaviour above. Say the word and I will plan that separately.

## Technical notes

- `supabase/functions/ebay-oauth/index.ts`, `auth_url` action: add `prompt=login` to the authorize query string so eBay always renders the consent/sign-in step.
- `src/components/settings/EbayIntegration.tsx`: after disconnect, render an inline note with the revoke link — `https://accounts.ebay.co.uk/acctsec/security-center/third-party-app-access` (live) / the sandbox equivalent.
- No database or schema change; redeploy `ebay-oauth`.
