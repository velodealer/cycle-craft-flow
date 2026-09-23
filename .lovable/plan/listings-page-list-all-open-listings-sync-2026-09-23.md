# Listings page: List all, open listings, sync

## What changes
1. **"List all bikes" button** at the top of the page (large, primary). Lists every bike shown (current search/filter) on every connected site where it isn't already live. Asks for confirmation first ("List 12 bikes on eBay and Shopify?"), then works through them one at a time with a progress count ("Listing 3 of 12…"). Ends with one summary message: how many listed, and which failed with the reason. Disabled when nothing is left to list.
2. **"Listed on eBay" / "Listed on Shopify" buttons become links** — clicking opens the live listing in a new tab (with a small open-in-new-tab icon). "Listed everywhere" becomes a small menu/pair of links when both are live.
3. **"Sync listing" button** on each bike that is live somewhere. It re-sends the bike's current details — spec, price, photos, title, item specifics, condition, and your settings/listing format — to each site it's live on, updating the existing listing rather than creating a new one. Per-site messages report success or the site's reason for refusing.
4. **"Sync all listings"** next to "List all bikes" at the top, doing the same for every live bike, with the same progress and summary.

## Technical details
- Only `src/pages/ListingsPage.tsx` changes; no backend changes.
- Sync reuses `listBikeOnEbay` / `listBikeOnShopify`: both functions update the existing listing when one exists (eBay updates inventory item + offer; Shopify updates the product).
- Bulk actions run sequentially to avoid eBay rate limits; a `bulk` state `{kind, done, total}` drives progress and disables per-card buttons while running.
- Link buttons use `listing_url` / Shopify product URL with `target="_blank" rel="noopener noreferrer"`; fallback to disabled "Listed" if no URL is stored.
