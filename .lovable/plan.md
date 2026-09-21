# Fix eBay item link (missing www.)

## Problem
After listing a bike, the "view on eBay" link opens `https://sandbox.ebay.co.uk/itm/<id>` — without `www.` the page fails to load entirely (connection error). Verified: the same URL with `www.` loads fine (HTTP 200).

## Current state (verified)
- `itemBase()` in `supabase/functions/_shared/ebay.ts` returns `https://www.ebay.co.uk/itm/` for production (already correct) but `https://sandbox.ebay.co.uk/itm/` for sandbox (missing `www.`).
- The bike's saved listing row in `public.ebay_listings` stores the old no-`www.` URL, so the link on the bike page stays broken even after the code fix.

## Changes
1. `supabase/functions/_shared/ebay.ts` — `itemBase()` sandbox branch becomes `https://www.sandbox.ebay.co.uk/itm/`.
2. Update the existing row in `public.ebay_listings` for bike `27398d50-6b01-4a91-bcfe-74fa8634f415` to `https://www.sandbox.ebay.co.uk/itm/110590750359` so the current link works immediately.
3. Redeploy the edge functions that use `itemBase` (`ebay-oauth`) so the fix is live.

## Verification
- Confirm the updated URL loads (HTTP 200).
- Check the link on the bike detail page now points to the `www.` address.
