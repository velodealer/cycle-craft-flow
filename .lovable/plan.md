# Fix eBay test notification (HTTP 412)

## What went wrong
eBay's test message did reach VeloDealer. We turned it away because we couldn't check eBay's signature, not because the signature was wrong. To check it, we have to fetch eBay's public key. The logs show that lookup failed: the sandbox answered "key id does not exist", and the production lookup's error was overwritten, so we can't see it. The likely cause: the test was sent from your **production** eBay keyset, but VeloDealer only holds **sandbox** app keys (eBay is connected via sandbox). A production key can't be fetched with sandbox app keys.

## Fix
1. Add separate production eBay app keys, `EBAY_PROD_CLIENT_ID` and `EBAY_PROD_CLIENT_SECRET`, from the same production keyset page as the screenshot. You'll be asked to enter them in a secure form. Production lookups use these keys; sandbox lookups keep the existing ones.
2. Log both the production and sandbox errors, so the real cause is visible next time.
3. Only answer 412 when the signature has actually been checked and doesn't match. If we can't fetch the key (a problem on our side), log it clearly and accept the message with 204. eBay then won't mark the endpoint as failing, and nothing unverified gets actioned: these messages are only logged anyway.
4. Redeploy, then ask you to press **Send Test Notification** again and confirm from the logs.

## Technical details
- `supabase/functions/ebay-notifications/index.ts`: `appToken(env)` picks `EBAY_PROD_CLIENT_*` for production (falling back to `EBAY_CLIENT_*`); `publicKey` collects errors per environment; `verifySignature` returns `'valid' | 'invalid' | 'unverifiable'`; only `'invalid'` gets 412.
- Request the two secrets with add_secret after deploying.
