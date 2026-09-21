# Fix the eBay 4,000-character description error

## What's actually wrong
We send the listing text twice: once on the inventory item record and once on the offer. Only the inventory item field is capped at 4,000 characters — the offer's listing description allows up to 500,000. Your saved listing format is longer than 4,000, so the first call fails before the offer is ever created.

No Trading API needed, and createOffer is already what we use.

## The fix
- Send the full listing format in the offer's listing description (500,000-character allowance) — this is the text buyers see.
- On the inventory item record, send a short summary instead: the bike's own description text, cut to a sentence boundary under 4,000 characters, with markup stripped. This field never reaches the buyer once the offer carries its own description.
- Same handling when updating an existing live listing, so re-listing a bike can't hit the cap either.
- If eBay still rejects the description for any other reason (banned markup, links), you get a plain-English message naming the reason.

## Mobile note
eBay builds the mobile "short description" from the first 800 characters of the full text. Worth knowing when you write your listing format — the opening lines are what most buyers see first. No code change for this; flagging it so you can put the key selling points at the top.

## Technical details
- `supabase/functions/_shared/ebay-listing.ts`: keep `descriptionHtml` (the rendered template) for `offerBody.listingDescription`; add a `summaryFor(bike)` helper producing a plain-text, tag-stripped, sentence-boundary-truncated string under 4,000 characters for `product.description` on the `PUT /sell/inventory/v1/inventory_item/{sku}` call.
- Redeploy `ebay-sync-bike`.

## Result
BPS-TRE-027T and any other bike with a long listing format list successfully, with the complete description on the live eBay listing.
