# Fix eBay "Core Inventory Service internal error" (500)

## What is happening

The failure is happening on bike BPS-CAN-0032, at the first step, when VeloDealer sends the bike's details to eBay. eBay answers with a generic "system error" (code 25001) instead of naming the problem. This error is well known. It usually means eBay received details it can't store, but its own checks didn't catch them. The usual triggers are:

- an item specific value longer than 65 characters (for example, long fitted-part text)
- an item specific name longer than 40 characters, or empty values
- more than 30 values under one item specific
- a summary description or title over eBay's limits

BPS-CAN-0032 was recently filled with all 17 fitted parts from 99Spokes, so long part values are the most likely cause. eBay's error doesn't confirm that, so the first step is to check the real data.

## The fix

1. Log the exact details sent for BPS-CAN-0032 and look for the value or values that break eBay's limits.
2. Clean every item specific before sending it to eBay:
   - shorten values to 65 characters at a word boundary
   - drop empty values and duplicates
   - keep at most 30 values per specific
   - skip names longer than 40 characters
   - cap the title at 80 characters and the summary description at 4,000
3. Retry once automatically if eBay returns a 500, because a real eBay outage can cause the same error.
4. If eBay still fails, show a plain message instead of the raw eBay text: "eBay had a temporary problem saving this bike. Try again in a few minutes."
5. Show a warning in the listing preview whenever a value was shortened, so the dealer knows.

## Technical details

- `_shared/ebay-listing.ts`: add a `sanitizeAspects()` helper and apply it inside `ebayInventoryProduct()`. Also cap `title` and `description` there. Add a Deno test covering long, empty, duplicate and too-many values.
- `_shared/ebay.ts` `ebayFetch`: retry once after about 1.5 seconds on 5xx for idempotent PUT/GET calls. Map errorId 25001 to the friendly message, and keep the raw text in the logs.
- Pass any shortening notes into `prepareListing` warnings and the checklist.
- Redeploy `ebay-sync-bike`, run the eBay tests, then retry BPS-CAN-0032 and read the function logs.
