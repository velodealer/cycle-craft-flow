# Fix the "Invalid value for header Accept-Language" eBay error

Listing a bike fails because of a request header, not your eBay account or the bike itself.

## What's happening

Every request we send eBay carries a language header. We set the "content" language to en-GB, but we never set the "accept" language, so the runtime sends a wildcard value (`*`) that eBay rejects outright with a 400. That's the message you saw.

## The fix

- Send `Accept-Language: en-GB` alongside the existing content language on every eBay request, matching the shop's marketplace (en-GB for the UK, en-US for EBAY_US, and so on) so the same call works if you ever sell on another eBay site.
- Retry listing the bike afterwards to confirm the item goes up.

## Also seen in the logs

Just before that error, eBay reported the shop's despatch location did not exist yet (`merchantLocationKey not found`). The code creates it on the fly, and that create call was hit by the same bad header — so fixing the header should clear both. If the location still fails after the fix, I'll report exactly what eBay says rather than guessing.

## Technical notes

- `supabase/functions/_shared/ebay.ts`, `ebayFetch`: add `'Accept-Language'` to the header block, derived from the marketplace id (map `EBAY_GB` → `en-GB`, `EBAY_US` → `en-US`, `EBAY_AU` → `en-AU`, `EBAY_DE` → `de-DE`, `EBAY_IE` → `en-IE`, default `en-GB`), and use the same value for `Content-Language`.
- Redeploy `ebay-sync-bike` and `ebay-oauth` (both import the shared helper), then list a bike and read the function logs to confirm the 400 is gone.
