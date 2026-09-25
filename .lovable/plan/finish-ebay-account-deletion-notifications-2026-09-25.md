# Finish eBay account-deletion notifications

eBay won't let the app go live until the "Marketplace account deletion" box on the screen you shared has a working web address and a verification token. VeloDealer already has an endpoint for this. It needs a few fixes and a token before you paste the details in.

## What you'll enter on eBay
- **Endpoint:** `https://api.velodealer.com/functions/v1/ebay-notifications`
- **Verification token:** a random 32–80 character value. I'll open a secure form for it and show you what to paste on eBay. You use the same value in both places.
- Press **Save**, then **Send Test Notification**. eBay should show a green tick.

## Changes
1. **Exact address match.** eBay checks a code built from the exact address you type in. Right now the endpoint builds that code from the internal backend address, not `api.velodealer.com`, so eBay's check would fail. It will use the public address instead, and the address can be changed later if needed.
2. **Open to eBay.** Make sure eBay can call the endpoint without signing in, like the other webhooks.
3. **Verify messages really come from eBay.** Check eBay's signature on every deletion message using eBay's public key. Faked messages get refused. Real ones get a quick "received" reply, as eBay requires.
4. **Record each request.** Keep a short log entry (eBay username or user ID, time). VeloDealer stores no eBay buyer profiles, so there's nothing else to delete.
5. **Token.** Ask you to save the verification token, following eBay's rules: letters, numbers, `_` and `-` only.

## Technical notes
- `ebay-notifications/index.ts`: `endpointUrl()` reads `EBAY_NOTIFICATION_ENDPOINT` and falls back to `https://api.velodealer.com/functions/v1/ebay-notifications`. The challenge hash is `sha256(challenge_code + token + endpoint)`, returned as `{challengeResponse}` with a JSON content type.
- POST: decode the `X-EBAY-SIGNATURE` header (base64 JSON with `kid` and `signature`), fetch the public key with an app token via `GET /commerce/notification/v1/public_key/{kid}` and cache it, then verify ECDSA SHA-1 over the raw body. Invalid → 412. Valid → 204.
- `supabase/config.toml`: `[functions.ebay-notifications] verify_jwt = false`.
- Secret `EBAY_VERIFICATION_TOKEN`: the user saves it through the secure form, since the same value goes on eBay. Then deploy and test the challenge with curl.
