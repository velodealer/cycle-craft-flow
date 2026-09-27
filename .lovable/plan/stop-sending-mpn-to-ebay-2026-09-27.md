# Stop sending MPN to eBay

## What's happening (checked)

- eBay's category data for our bike category marks **MPN as recommended, not required**. Only Brand is required.
- Two bikes failed to list with eBay's error: `Input data for tag <BrandMPN> is invalid or missing` — this is eBay's brand/MPN pairing rule, triggered by what we send.
- On our side MPN is already optional: it's only sent when the bike has one filled in. But it goes to eBay in two places (the product's MPN field and the item specifics), and either can trip the pairing rule.

## The fix

1. **Remove MPN from everything we send to eBay** — both the product MPN field and the "MPN" item specific. The MPN box stays in VeloDealer for your own records; it just no longer leaves the building.
2. **Test one listing against eBay sandbox** to confirm the BrandMPN error is gone and the listing publishes.
3. If eBay still insists on a brand/MPN pair for the category, I'll report back before doing anything else (the fallback eBay suggests is sending "Does Not Apply", but I won't add that without your say-so).

## Technical details

- `supabase/functions/_shared/ebay-listing.ts`: delete the `product.mpn` assignment (lines 757–758).
- `supabase/functions/_shared/ebay-aspects.ts`: remove the `/^mpn$/` candidate so MPN never appears in item specifics.
- No database changes. The `bikes.mpn` column, the bike form field and the readiness list stay as they are.
- Redeploy `ebay-sync-bike` and re-test one bike end to end.
