# Use eBay's Trading API for full-length descriptions

## The situation
The app lists bikes through eBay's newer Inventory API, which caps the item description at 4,000 characters — that's where the error comes from. The older Trading API you linked allows up to 500,000 characters. Both can be used against the same listing: we publish as now, then immediately push the full description with the Trading API's `ReviseItem`, which lifts the limit.

## What we'll build

### 1. Publish, then revise with the full description
- Keep the current publish flow, but send a short safe description in the first step (the listing format trimmed to fit 4,000 characters) so publishing always succeeds.
- Straight after the listing goes live, call the Trading API `ReviseItem` with the complete rendered listing format — no practical length limit.
- On later updates to an already-live bike, go straight to `ReviseItem` with the full description.
- If the revise call fails for any reason, the listing still stands with the shorter description and the failure is recorded rather than blocking the listing.

### 2. Record what happened on the bike
- The bike's Activity timeline gets an entry when the full description is applied, and a clear one if it couldn't be (with eBay's reason), so you always know which version is live.

### 3. Errors in plain English
- If eBay rejects the description (unsupported markup, banned links, active-content rules), you get a readable message naming the reason instead of raw XML.

## Technical details
- New shared helper `supabase/functions/_shared/ebay-trading.ts`: XML request builder + response parser for the Trading API (`https://api.ebay.com/ws/api.dll`, sandbox equivalent), using the existing OAuth access token via the `X-EBAY-API-IAF-TOKEN` header plus `X-EBAY-API-CALL-NAME`, `X-EBAY-API-SITEID` (3 for UK), and `X-EBAY-API-COMPATIBILITY-LEVEL`.
- `ReviseItem` with `ItemID` (the listing id already stored in `ebay_listings`) and `Description` wrapped in CDATA.
- `_shared/ebay-listing.ts`: safe-trim helper for the initial publish, revise step after publish/update, activity logging, error mapping.
- Redeploy `ebay-sync-bike`.

## What may be needed from you
- Trading API calls need the app's **Dev ID** alongside the client id and secret. If eBay rejects the call for a missing dev name, I'll ask you for it and store it as a secret.
- The eBay connection may need reconnecting once so the token carries the scope Trading calls require; if so the card will say so.

## Result
Bikes list with the complete listing format, however long it is — BPS-TRE-027T included — with the 4,000-character wall gone.
