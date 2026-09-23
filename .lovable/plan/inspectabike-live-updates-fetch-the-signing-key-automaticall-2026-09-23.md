# InspectABike live updates: fetch the signing key automatically

## What I checked on VeloDealer's side
- Broximo's connection is active, and it got a fresh access token at 14:40 today.
- No signing key is stored on it yet.
- Incoming updates are already checked against each dealer's own key first, so that part is ready.
- No live updates have arrived so far.

## What to build
1. **Get the key automatically.** VeloDealer asks InspectABike for its signing key using the connection it already has, then saves it for that dealer. No one has to paste anything.
2. **When it runs:**
   - Straight after connecting, if InspectABike didn't send a key.
   - When the InspectABike settings card opens and no key is saved yet.
   - When a dealer admin presses a new "Get signing key" button on that card.
3. **Status line on the card.** The "Live updates" line shows "Ready" once the key is saved, or a plain-English reason if the request fails.
4. **Old shared key stays as a backup only.** It is only used when a dealer has no key of their own, and the card warns when that happens.

## Once built (you and InspectABike)
- InspectABike has already saved VeloDealer's update address on their side.
- Open Settings > Integrations. The key is fetched on its own, and the card should show "Ready".
- Mark a fault repaired on BPS-GIA-5137 in InspectABike. I'll then check that the update arrived, its signature matched and it was matched to Broximo.
- Press Refresh on BPS-GIA-5137 and check its faults.

## Technical
- Add a `fetch_webhook_secret` action to inspectabike-oauth. It sends `PUT {INSPECTABIKE_BASE_URL}/partner-webhook-config` with the dealer's bearer token (via getAccessToken, which refreshes it if needed) and body `{ "webhook_url": webhookUrl() }`. It saves the returned `webhook_secret` to `inspectabike_connections.webhook_secret` using the service role. The secret value is never returned to the browser.
- InspectABike has already saved VeloDealer's update address and all five events on their side.
- Call this action at the end of the OAuth callback when the token response has no `webhook_secret`.
- Add `fetchWebhookSecret()` to src/services/inspectabike.ts. InspectABikeIntegration.tsx calls it automatically when `has_webhook_secret` is false, and shows the button to admin/owner users.
- inspectabike-webhook keeps checking the dealer's own key first and the shared key second, and logs which key matched.
