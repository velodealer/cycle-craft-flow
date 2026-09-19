# Fix logistics tracking number and status

Two problems on the Logistics page for bike G6JF09691 (BPS-GIA-9691):

1. The Tracking column falls back to the courier's internal record ID (a long GUID) when no CCC tracking number is stored. That bike's row currently has no tracking number saved at all.
2. Its status is stored as "cancelled", although the job was delivered in Cycle Courier Co.

## What will change

### Tracking shows the CCC number only
- Never display the internal courier record ID in the Tracking column or cards. When no CCC number is known yet, show "Awaiting tracking" instead.
- Search still matches both, so staff can find a record either way.
- Pull the CCC number from Cycle Courier whenever a record is refreshed, booked, or a courier update arrives, and save it against the movement.

### Status reflects the courier
- First step: record the exact shape of one live courier order response (for this bike's order) so the correct status and tracking fields are read rather than guessed. If the courier response uses different field names than the code currently expects, the mapping is corrected to match.
- Courier updates arriving by webhook are translated through the same status mapping used elsewhere (completed/delivery completed to Delivered, picked up to Collected, canceled to Cancelled, and so on), rather than being written into the record raw.
- A final state won't be overwritten by an older or lesser update: once a movement is delivered it stays delivered, and a stale "cancelled" is replaced when the courier reports delivery.
- The refresh button reconciles each visible movement against the courier, so this bike will correct itself to Delivered after one refresh.

## Technical notes

- `src/components/logistics/LogisticsList.tsx`: drop the `Order {order_id}` fallback in both the card and table tracking cells; keep the courier-order link in the actions column.
- `supabase/functions/cycle-courier-order-sync/index.ts`: log the raw order payload once, then widen status/tracking extraction to the confirmed fields (including nested `status.current`/`statusHistory` style shapes and `ccc`/`reference` style tracking fields if that is what the API returns); guard against downgrading a `delivered` record.
- `supabase/functions/cycle-courier-webhook/index.ts`: route `order.status.updated` / `delivery.status_updated` through a shared `normaliseStatus` helper (extract it into `_shared/cycle-courier.ts`) instead of writing `order.status` verbatim; apply the same no-downgrade rule and keep persisting the tracking number.
- `create-collection-order` / `create-delivery-order`: reuse the same tracking extraction so the CCC number is captured at booking when the API returns it.

## Validation

- Refresh Logistics and confirm BPS-GIA-9691 reads Delivered with a CCC tracking number (or "Awaiting tracking" if the courier genuinely returns none).
- Confirm no GUID appears in the Tracking column.
- Typecheck and build pass; functions redeployed.
