## Why it looks like a duplicate

A strip writes two rows in the `parts` table:

1. A **credit** on the bike — `bike_id = <bike>`, negative `cost_price`, `stock_status = sold`. Its only job is to reduce the bike's parts-cost total so the VAT/margin maths stay correct.
2. A **stock** row — `bike_id = null`, positive `cost_price`, `stock_status = in_stock`. This is the real inventory entry.

The `Parts Inventory` page (`PartList`) selects everything from `parts` with no `bike_id` filter, so the credit line shows up next to the real stock row.

## Fix

In `PartList.loadParts`, scope the query to true inventory only:

```ts
let query = supabase
  .from('parts')
  .select('*')
  .is('bike_id', null)            // exclude bike-attached rows (fitted parts + credits)
  .order('created_at', { ascending: false });
```

Effect:
- The −£800 credit on the BMC disappears from the inventory list (still present on the bike for cost accounting).
- The +£800 Enve wheels row remains as the single inventory entry.
- Fitted parts on bikes (which were already excluded from "inventory" in spirit) also drop off this view, matching what the "Add from inventory" picker treats as available stock.

## Out of scope

- Schema changes — no new column or flag is needed; `bike_id IS NULL` already distinguishes stock rows from bike-cost lines.
- Audit/history view of past credits — if you later want to see strip credits, that belongs on the bike's Parts & Labour panel (already shown there).

## Files

**Edited**
- `src/components/management/PartList.tsx` — add the `.is('bike_id', null)` filter to the query.
