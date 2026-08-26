# Bike labels + simpler bay allocation

## 1. Storage location: two plain fields

Today the location field is a single free-text input with a suggestion drop-down (datalist). Replace it with two small inputs side by side:

- **Bay** — short text (e.g. `A`), auto-uppercased
- **Number** — numeric (e.g. `12`)

Behaviour:
- Saved bay name is `Bay + Number` combined (e.g. `A12`), matching the existing naming so current bays keep working.
- On blur/Enter, if a bay with that name exists it is linked; otherwise a new bay is created automatically (same as now).
- Clearing both fields clears the bike's location.
- No suggestion list, no dropdown anywhere.

Applies everywhere the field appears: bikes list, intake list, cleaning, inspection, and the bike form.

## 2. Printable bike label

A label already exists but is only reachable after intake and shows the wrong fields. Update it and make it available from any bike.

Label content (4in x 6in print layout):
- Make and model, large
- Size
- Colour
- QR code linking to `/bikes/<id>`
- Small footer with short bike ID and date

Access:
- "Print label" button on the bike detail page (hidden in inspection mode)
- Keep the existing print-after-intake behaviour, updated to the new content

## Technical notes

- `src/components/bike/LocationSelect.tsx`: swap the single `Input` + `datalist` for two controlled inputs; keep the existing find-or-create bay logic, keying on the concatenated name.
- `src/components/bike/BikeLabel.tsx`: change `LabelContent` props to include `size` and `colour`, drop year/frame-number blocks, and point the QR value at `${window.location.origin}/bikes/${bike.id}` (the current value uses the older `/bikes?id=` form).
- `src/components/bike/BikeDetailView.tsx`: add a Printer button in the action bar that opens `BikeLabel` in a dialog/overlay, gated behind `!inspectionMode`.
- No database changes needed; `storage_bays` and `bikes.storage_bay_id` stay as they are.
