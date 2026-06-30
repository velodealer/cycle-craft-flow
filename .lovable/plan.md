## Drivetrain grouping in Break dialog

### Drivetrain slots
`['shifters', 'front_derailleur', 'rear_derailleur', 'cassette', 'chain', 'crankset', 'brake_calipers']`
(constant in `BreakBikeDialog.tsx`; verify each name matches `SPEC_SECTIONS` slot keys — adjust if any differ).

### UI
- Add a single `Checkbox` above the rows: **"Group drivetrain as a single row"** (default off).
- When **off**: behaves as today, one row per component/part.
- When **on**: all drivetrain component rows currently attached to the bike collapse into one synthetic row:
  - Label: `Drivetrain — <groupset name>` where `<groupset name>` is the existing bike `groupset` field if set, otherwise the brand most common across drivetrain components, otherwise just `Drivetrain`.
  - Sub-line lists the included slot labels (e.g. "Shifters, Rear derailleur, Chain, Cassette").
  - Single Keep checkbox, single value input.
- Non-drivetrain rows (parts, wheels, bars, saddle, etc.) stay as individual rows regardless of toggle.

### Save behaviour (grouped)
When the synthetic drivetrain row is kept:
1. Insert one credit row on the bike: `description = 'Stripped: Drivetrain — <groupset name>'`, `cost_price = -value`, `stock_status = sold`, `type = secondhand_stripped`.
2. Insert one inventory parts row: `description = 'Drivetrain: <groupset name>'`, `cost_price = value`, `stripped_from_bike_id = bike.id`, `stock_status = in_stock`, `type = secondhand_stripped`, plus a `notes` field listing the included slot labels.
3. Delete all the corresponding `bike_components` rows for the drivetrain slots in a single `.in('id', [...])` call.

If the drivetrain row is **not** ticked while grouping is on, the underlying drivetrain components remain on the bike — same as unticking any other row today.

### Edge cases
- Grouping checkbox is disabled (and forced off) when zero drivetrain components are attached.
- Headroom/overspent math is unchanged — synthetic row contributes its single value.
- Toggling the checkbox resets only the drivetrain entries in `keep` state; other rows keep their checked/value state.

### Files

**Edited**
- `src/components/bike/BreakBikeDialog.tsx` — drivetrain slot list, grouping toggle, synthetic row rendering, grouped save path.

No schema changes, no other files touched.
