# Changing a fitted component keeps the old part's details

## Problem
On a bike's Specification section, swapping the component in a slot only updates the link (`component_id`). The per-bike detail fields saved on that row (brand, model, part number, attributes, spec values, notes) from the *previous* component are left in place. Because every reader prefers those per-bike values over the shared library entry, the newly chosen component displays with the old part's details.

## Fix
In `src/components/bike/BikeSpecificationSection.tsx` (`onSlotChange`):
- When a different component is chosen for a slot, clear the per-bike override fields (`brand`, `model`, `mpn`, `attributes`, `spec_overrides`, `notes`) in the same save, so the new component's own library details show through.
- The shared library entry is never touched — only the bike's own row is cleared.
- Removing a component from a slot (choosing "none") already deletes the row; unchanged.

## Verification
- Type check passes.
- Manually verify: swap a component on a bike, confirm the new component's brand/model/part number show, and the old part's details are gone.

## Technical details
- Single-file change: extend the `upsert` payload in `onSlotChange` to set the override columns to null when `component_id` differs from the currently linked one.
- No schema, RLS, or migration changes.
