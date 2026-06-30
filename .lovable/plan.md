## Add bar+stem grouping and a Frame row to Break dialog

### 1. Bar & stem grouping
- New constant `COCKPIT_SLOTS = ['handlebars', 'stem']`.
- Second toggle above the list: **"Group bar & stem as a single row"** (disabled when neither slot is attached).
- Synthetic group row, kind `'group'`, id `'cockpit'`, label `Cockpit — <brand>` (most common brand across the bundled slots, else `Cockpit`).
- Save path mirrors the drivetrain group: one credit row on bike, one inventory row `Cockpit: <name> (Handlebars, Stem)`, delete the bundled `bike_components` rows in a single `.in('id', […])` call.

### 2. Frame row
- Synthetic row at the top of the list, kind `'group'`, id `'frame'`, with `componentIds: []` and `slotLabels: []`.
- Label: `Frame — <make> <model>` plus size if present (e.g. `Frame — BMC Teammachine SLR-01 (54)`).
- Always present (frame is implicit on every bike).
- On keep + save:
  1. Insert credit row on bike: `description = 'Stripped: Frame — <…>'`, `cost_price = -value`, `stock_status = sold`, `type = secondhand_stripped`.
  2. Insert inventory row: `description = 'Frame: <make> <model> (<size>)'`, `cost_price = value`, `stripped_from_bike_id = bike.id`, `stock_status = in_stock`, `type = secondhand_stripped`.
  3. No `bike_components` delete (frame has no slot).

### 3. Row ordering
Frame → Cockpit (if grouped) → Drivetrain (if grouped) → remaining components → parts.

### Edge cases
- Grouping toggles independently disable when the relevant slots aren't attached.
- Headroom math unchanged — all kept rows (including Frame) contribute to total.
- Frame row credit means a fully-kept bike (frame + all components at their bike-cost share) zeroes headroom, matching today's component-strip accounting.

### Files

**Edited**
- `src/components/bike/BreakBikeDialog.tsx` — add `COCKPIT_SLOTS`, second toggle, frame synthetic row generation, save branch tweaks to handle frame (no slot delete).

No schema, no other files.
