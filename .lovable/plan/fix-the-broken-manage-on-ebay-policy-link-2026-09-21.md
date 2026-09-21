# Fix the broken "Manage on eBay" policy link

The link on the eBay card points at an old address (`bizpolicy.ebay.co.uk/businesspolicy/manage`) that eBay has retired, so it opens a broken page.

## What changes

1. Point the link at eBay's current business policies page:
   - live selling: `https://www.ebay.co.uk/bp/manage`
   - test selling: `https://www.sandbox.ebay.co.uk/bp/manage`

2. Show a clear message when the eBay account hasn't switched business policies on.
   The connected account is currently refusing every policy request with "Seller is not opted in to business policies", which is why the three pickers are empty and creating a policy fails. Instead of the raw eBay wording, the card will say that this eBay account needs business policies turned on first, with the same link to do it. The message appears both on the card (when loading the list fails) and inside the New/Edit form (when saving fails).

## Technical notes

- `src/components/settings/EbayIntegration.tsx`: replace the `policiesUrl` values with the `/bp/manage` addresses.
- `supabase/functions/ebay-oauth/index.ts`: in the eBay request helper, translate eBay error id `20403` ("not opted in to business policies" / "not eligible for Business Policy") into a plain-English message; the `policies` action already swallows per-kind failures, so also return an `opt_in_required: true` flag alongside the empty lists so the card can show the notice.
- `src/services/ebay.ts`: add the flag to the `EbayPolicies` type.
- `EbayPolicyDialog.tsx` already renders the returned error text, so no change beyond the friendlier wording.
- Redeploy `ebay-oauth`.
