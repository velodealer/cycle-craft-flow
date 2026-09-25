# Removing a fitted part should take it off the bike properly

## What's wrong
Clearing a part from a spec row (the picker's clear/"none" option) only unlinks it from the spec. The part you fitted from stock stays against the bike: its cost still counts in the bike's costs and it never goes back to parts inventory.

## What will change
When you clear a spec row, a small dialog opens asking what to do with that part:

- **Return to stock** (default when it was fitted from stock) — the part goes back into parts inventory at its original cost, and the bike's parts cost drops by the same amount.
- **Return to stock at a different value** — same, but you enter the value (e.g. it's now worn).
- **Discard** — just removes it from the spec (for original parts you don't want to keep).

For the wheel you already removed, I'll put it back into stock and take its cost off the bike as part of this fix.

## Accounting
- If the part was fitted from stock and posted to QuickBooks/Xero, returning it posts the reverse entry (Dr Parts stock / Cr Stock) — only when a Parts stock account is mapped, same as fitting. Otherwise nothing is posted, which is correct.
- Postings run independently and never block the removal.

## Technical details
- `BikeSpecificationSection.onSlotChange(null)` currently only deletes `bike_components`. Route it through a new "Remove part" dialog (reuse `StripComponentDialog` pattern).
- Find the fitted `parts` row for that bike/slot (fitted parts: `bike_id = bike`, `stock_status='sold'`, matching component). If found: set `bike_id=null`, `stock_status='in_stock'`, cost as chosen, clear `fit_*_posting_id`; if not found (original part): insert credit row + in-stock part as the strip flow does.
- New `quickbooks-unfit-part` / `xero-unfit-part` edge functions (or a `reverse` flag on the fit functions) with idempotency.
- Repair the already-removed wheel on the affected bike with a one-off data fix after confirming the row.
