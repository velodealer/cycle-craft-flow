# Shopify "Listed" tick and delist alerts for manual Shopify

For dealerships that list on Shopify by CSV (not connected), VeloDealer can't see Shopify, so staff need to tell it what's live. Connected Shopify already updates itself and already goes to stock zero when a bike sells on eBay.

## 1. "Listed on Shopify" tick
- Each bike gets a **Listed on Shopify** tick, on the Listings page row and in the Shopify section of the bike page. Ticking records who and when, in bike history.
- If anything that goes into the Shopify file changes afterwards, the tick clears itself and the bike shows **Changed — re-export**. That covers price, title or custom title, description, condition, size, colour, specs, fitted parts and listing images.
- The Listings page gets a filter **Needs Shopify export** (never ticked, or changed since). "Export Shopify CSV" can export just those in one click, and offers to tick them all once downloaded.

## 2. eBay sale → delist from Shopify
- When an eBay sale comes in for a bike that's ticked as listed on Shopify (manual), VeloDealer:
  - adds "Remove from Shopify" to the sale email it already sends,
  - shows the bike under a **Remove from Shopify** alert on the Listings page and dashboard,
  - lets staff press **Removed from Shopify** to clear the alert (logged in history).
- The same applies if the bike is marked sold any other way (manual sale, Squarespace order), so a sold bike never stays on Shopify unnoticed.
- Connected Shopify dealers: no change; the item is already set to zero stock automatically.

## Technical details
- Migration: add to `bikes` `shopify_manual_listed_at timestamptz`, `shopify_manual_listed_by uuid`, `shopify_manual_stale boolean default false`, `shopify_delist_required_at timestamptz`. A `BEFORE UPDATE` trigger on `bikes` sets `shopify_manual_stale = true` when listing-relevant columns change while ticked, and sets `shopify_delist_required_at` when status moves to sold/collected/delivered while ticked. A trigger on `bike_components` and `ebay_listings.title_override` changes marks the bike stale too.
- `ebay-order-sync`: include the remove-from-Shopify line in the email when `shopify_manual_listed_at` is set and Shopify isn't connected.
- UI: tick + badges in `ShopifyListingCard` and `ListingsPage`; filter and "export only needing export"; dashboard alert card; activity entries via `logActivity`.
- Only shown when Shopify manual listing is turned on in Settings.
