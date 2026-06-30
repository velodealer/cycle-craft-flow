## Why nothing happens today

The Wheelset under **Spec → Wheels** is stored in `bike_components`. The Strip-to-inventory action I added only sits on rows in the **Parts & Labour** table (the `parts` table). The X next to the Wheelset just unlinks the component — it does not move anything to stock and does not touch cost.

## Fix

### 1. Add a "Strip to inventory" action on every component slot

In `BikeSpecificationSection`, next to each `ComponentPicker` that already has a component selected, render a small package-minus icon button (alongside the existing X). Hidden when the slot is empty.

Clicking it opens a dialog:

- Brand / model are shown read-only (pulled from the linked component).
- **Inventory value (£)** — required, no default (components have no recorded cost today).
- Optional notes.

### 2. What the action does on confirm

To keep symmetry with the Parts table flow ("removes it from the cost of the bike and adds it to inventory at that cost"), it writes two `parts` rows in one go:

1. **Credit on the bike** — `bike_id = <bike>`, `cost_price = -value`, `quantity = 1`, `type = secondhand_stripped`, `stock_status = sold`, description `"Stripped: <slot label> — <brand model>"`. This reduces the bike's parts-cost total by the entered value, which feeds the existing VAT/margin calc with no other plumbing.
2. **New inventory row** — `bike_id = null`, `stripped_from_bike_id = <bike>`, `cost_price = value`, `stock_status = in_stock`, `type = secondhand_stripped`, brand/description copied from the component.

Then delete the `bike_components` row so the slot empties.

The "Add from inventory" flow already does the reverse (adds value back to bike cost) so swapping Enve £300 out and Fulcrum £100 in gives a net £200 reduction in bike cost.

### 3. Break-bike dialog uses the same credit model

Update `BreakBikeDialog` so that for every kept **component** it also writes the matching negative-cost credit row on the bike before deleting the `bike_components` link. Kept parts already move correctly (the row is just flipped to inventory).

## Files

**New**
- `src/components/bike/StripComponentDialog.tsx` — slot-level strip dialog (value + notes).

**Edited**
- `src/components/bike/BikeSpecificationSection.tsx` — render the strip button per slot, wire to the dialog, refresh on save.
- `src/components/bike/BreakBikeDialog.tsx` — write the credit row for each kept component.

## Out of scope

- Editing the original `purchase_price` of the bike (we use a credit line instead so the audit trail is preserved).
- A reverse "un-strip" flow.
