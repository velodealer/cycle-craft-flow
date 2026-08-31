# Add "Collected" and "Delivered" bike statuses

Two new bike statuses, with "Delivered" set automatically by the Cycle Courier Co webhook.

## What changes

1. **New statuses**: `collected` and `delivered` added to the bike status list.
   - `collected` — the courier has picked the bike up.
   - `delivered` — the courier has dropped the bike off (customer delivery for outbound, or your workshop for inbound).

2. **Automatic marking from the courier webhook**
   - When Cycle Courier Co reports the pickup is done, the bike becomes `collected`.
   - When Cycle Courier Co reports the drop-off is done (`delivery.completed` / `order.delivery.completed`, and the `delivered` status update event), the bike becomes `delivered` and the courier job is stamped as completed.
   - This applies to outbound deliveries (sold bikes going to customers). Inbound collections keep their existing behaviour of landing on `pending_intake` / `intake` so the intake workflow still triggers.

3. **Where the statuses appear**
   - Admin status dropdown on the bike page gains "Collected" and "Delivered".
   - Progress bar labels updated so the collection/delivery stages use the real statuses instead of reusing `in_transit` / `pending_intake`.

## Technical notes

- Database migration: `ALTER TYPE bike_status ADD VALUE 'collected'` and `'delivered'`.
- `supabase/functions/cycle-courier-webhook/index.ts`: branch on `collection.direction` ('inbound' vs 'outbound') in the collection-completed, delivery-completed and `order.status.updated` cases; outbound maps pickup → `collected`, drop-off → `delivered`; inbound keeps current mapping.
- `src/components/bike/AdminStatusSelect.tsx`: add the two options.
- `src/components/bike/StatusProgressBar.tsx`: collection stage keys become `awaiting_collection` → `collected` → `delivered`, keeping the existing inbound stages working.
