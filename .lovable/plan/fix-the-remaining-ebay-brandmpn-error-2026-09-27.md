# Fix the remaining eBay BrandMPN error

## Confirmed cause

The MPN itself is no longer being sent. However, the listing payload still sends the bike make twice:

- as eBay's required **Brand** item specific; and
- as the separate top-level product `brand` field.

The latest attempt for **BPS-TRE-027T** confirms the inventory item update succeeded, then publishing offer **11772735010** failed with `BrandMPN`. That means eBay is interpreting the separate product `brand` field as the start of a Brand/MPN catalogue pair, even though MPN is optional for Bikes. The required Brand item specific is already supplied independently, so the top-level product field is redundant.

## Changes

1. Remove the separate top-level product `brand` field from the eBay Inventory API payload.
2. Keep **Brand** in `product.aspects`, where eBay requires it for category 177831.
3. Add a regression test proving the payload includes the Brand item specific but includes neither `product.brand` nor MPN.
4. Redeploy the eBay listing function.
5. Retry **BPS-TRE-027T** in the sandbox. If eBay retained stale catalogue data on the existing inventory item, delete and recreate only that failed unpublished inventory item and offer, then publish again.
6. Confirm the listing succeeds and clears the saved error before treating the issue as fixed.

## Scope

No bike MPN data will be deleted. MPN remains available inside VeloDealer and remains excluded only from eBay listings.
