# Map our bike condition to eBay's real condition list

## What's wrong
eBay's Road Bikes category (177831) only accepts four conditions: **New (1000)**, **New – other (1500)**, **Used (3000)** and **For parts or not working (7000)**. This comes from eBay's own condition list, which we already save.

We currently treat eBay's "Used" (3000) as "Used – excellent", so it counts as *better* than "Used – very good". Our "never describe the bike as better than it is" rule therefore skips it, and the only remaining option is "For parts or not working". That's why BPS-TRE-027T shows **Condition changed → For parts**.

## What changes
1. **Follow the category's own conditions.** Build the choice from the conditions eBay lists for the bike's category, not a fixed internal ladder.
2. **Clear mapping from our condition to eBay's.** Where a category only has a general "Used" option, every used grade maps to it:

   | Our condition | eBay (177831) |
   |---|---|
   | New | New (1000) |
   | New – other / New with defects / Like new | New – other (1500), else Used |
   | Used – excellent / very good / good / acceptable | Used (3000) |
   | For parts or not working | For parts (7000) |

   Categories that do offer detailed used grades (4000/5000/6000) still get the exact grade.
3. **"For parts" is never picked automatically for a working used bike.** If no sensible match exists, listing stops with a clear message instead of downgrading.
4. **Keep the grade visible to buyers.** When a detailed grade collapses to "Used", the condition description starts with e.g. "Condition: Used – very good." ahead of the condition notes.
5. **Plain labels.** The eBay card's condition dropdown and the "Condition changed" notice use eBay's wording for that category (e.g. "Used"), and the notice only appears when the meaning actually changed.
6. **CSV export uses the same mapping**, so File Exchange uploads get 3000 for used bikes instead of guesses.
7. **Existing listings:** clicking "Update listing" on BPS-TRE-027T (and any other bike listed as "For parts") resends as "Used". I'll list any affected bikes so you can update them.

## Technical details
- `_shared/ebay-listing.ts`: replace `CONDITION_RANK`/`CONDITION_FALLBACK` ladder with a mapping table `ourCondition -> ordered eBay ids`, filtered by `allowedConditionIds` (cached in `ebay_category_cache`, kind `conditions`); treat 3000 as generic "Used" and 2750 as "Like new"; never auto-pick 7000 unless wanted is FOR_PARTS / USED_ACCEPTABLE-with-nothing-else → error instead.
- `substituted` flag only true when the meaning class changes (new→used etc.), not grade collapse.
- Prefix grade into `conditionDescription` when collapsed.
- `src/lib/listingCsv.ts` `ebayCondition()` uses the same table (177831 ids).
- Deno test: USED_VERY_GOOD with allowed [1000,1500,3000,7000] → 3000; NEW → 1000; FOR_PARTS → 7000.
- Redeploy `ebay-sync-bike` and other functions importing `ebay-listing.ts`.
