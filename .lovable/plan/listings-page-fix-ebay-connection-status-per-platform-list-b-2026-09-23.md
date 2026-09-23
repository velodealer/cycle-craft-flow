# Listings page: fix eBay connection status + per-platform list buttons

## Why eBay shows as "not connected"
eBay is connected, but it's flagged "needs reconnect" because it was connected before the new sales/promotion permissions were added. The Listings page wrongly counted "needs reconnect" as "not connected", so it showed the "Neither eBay nor Shopify is connected" note. (The logs also show eBay's sign-in has expired, so listing will fail until you reconnect eBay once.)

## Changes
1. **Connection status**
   - Treat eBay as connected whenever it has a saved connection, sandbox or live.
   - If eBay needs reconnecting, show an amber note at the top: "eBay needs reconnecting — Settings → Integrations → eBay" with a link, instead of "not connected".
   - Show a small "Sandbox" tag next to the eBay badge/button when connected to eBay's test mode.
   - The "neither connected" note only appears when truly nothing is connected.
2. **Buttons on each bike card**
   - Keep **List everywhere**.
   - Add **List on eBay** and **List on Shopify** buttons next to it.
   - Each button: hidden if that platform isn't connected; shows "Listed on eBay/Shopify" (disabled) when already live; shows a spinner while listing; toast with the platform's own reason if it fails.
   - On small screens the three buttons wrap onto their own row.

## Technical
- `src/pages/ListingsPage.tsx`: `ebayConnected = !!ebayStatus?.connected` (drop the `needs_reconnect` exclusion); add `ebayNeedsReconnect` banner; environment tag from `ebayStatus.environment`.
- Refactor the list handler into `listOn(bike, 'ebay' | 'shopify')`, with per-bike, per-platform busy state; "List everywhere" calls it for each eligible platform.
- No database or backend changes.
