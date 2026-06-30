## Goal

Let users move parts between a bike and the parts inventory, and "break" a bike entirely — keeping bike cost totals (and therefore VAT margin) accurate.

## 1. Remove a part from a bike → inventory

In `BikeCostsSection` Parts table, add a **Strip to inventory** action (alongside the existing Delete) on every parts row.

Dialog asks:
- Value (£) — defaults to the part's current `cost_price`
- Optional notes

On confirm:
- Update the existing `parts` row: `bike_id = null`, `stripped_from_bike_id = <bike.id>`, `stock_status = 'in_stock'`, `type = 'secondhand_stripped'`, `cost_price = <entered value>`, `quantity = 1`.
- The bike's parts cost (already summed in `BikeDetailView.refreshCosts`) drops by the stripped value, which feeds the existing margin/VAT calculation — no extra wiring needed.
- Toast + refresh.

The existing Delete button stays for mistakes; Strip is the correct action for "removed the wheels, keeping them".

## 2. Add a part from inventory to a bike

In the Parts section header, add a second button **Add from inventory** next to the existing **Add part**.

Opens a dialog with:
- Searchable list (description / brand / part_number) of `parts` where `stock_status = 'in_stock'` and `bike_id is null`.
- Selected part shows brand, description, current cost.
- "Fit to bike" cost field (defaults to the inventory `cost_price`, editable).

On confirm:
- Update that `parts` row: `bike_id = <bike.id>`, `stock_status = 'sold'`, `type = 'new_fitted'` if it was new otherwise leave, `cost_price = <entered value>`.
- Bike parts cost recalculates automatically.

This keeps a single row per physical part (no duplication), so inventory ledger and bike cost stay in sync.

## 3. Break a bike for parts

New **Break bike** button in `BikeDetailView` header (admin/manager only, same gating as edit). Hidden when status is already `sold` or `split_for_parts`.

Opens a multi-step dialog:

**Step A — choose components to keep**
- Lists every row currently linked to the bike from `bike_components` joined with `components` (brand, model, slot label) plus every `parts` row on the bike.
- Each row has a checkbox "Keep" + a "Value (£)" input.

**Step B — validate & confirm**
- Live total of entered keep-values.
- Bike's total cost = `purchase_cost + collection_cost + delivery_cost + sum(parts) + sum(jobs)` (already computed in BikeDetailView).
- Block submit if `total keep-value > bike total cost`. Show remaining headroom.

On confirm:
- For each kept `bike_components` row → insert a new `parts` row (`bike_id = null`, `stripped_from_bike_id = <bike.id>`, `stock_status = 'in_stock'`, `type = 'secondhand_stripped'`, brand/description copied from component, `cost_price = entered value`), then delete the `bike_components` row.
- For each kept `parts` row already on the bike → flip to inventory as in section 1.
- Update bike `status = 'split_for_parts'`.

## 4. Schema changes

Single migration:
- Add `'split_for_parts'` to the `bike_status` enum.
- (No new tables; reuse `parts` and `bike_components`.)

## 5. Files

**New**
- `src/components/bike/StripPartDialog.tsx` — single-part strip flow.
- `src/components/bike/AddPartFromInventoryDialog.tsx` — inventory picker.
- `src/components/bike/BreakBikeDialog.tsx` — full break flow with validation.

**Edited**
- `src/components/bike/BikeCostsSection.tsx` — Strip row action + "Add from inventory" header button + wire dialogs.
- `src/components/bike/BikeDetailView.tsx` — Break bike button, hide stage advance when status is `split_for_parts`, render new status label.
- `src/lib/bikeSpec.ts` — no change required (component slots already drive the break list via `bike_components`).

## Out of scope

- VAT margin scheme is recomputed implicitly from the cost total; no separate VAT settings UI is changed.
- No reverse "un-break" flow.
- No bulk inventory editing beyond the per-row value field in the break dialog.
