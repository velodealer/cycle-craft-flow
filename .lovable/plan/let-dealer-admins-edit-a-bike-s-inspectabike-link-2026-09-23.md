# Let dealer admins edit a bike's InspectABike link

For when a bike ends up pointing at the wrong InspectABike inspection (or none), a dealer admin can correct it by hand.

## What you will see

- In the InspectABike box of a bike's Inspection section, admins and owners get an **Edit link** button.
- It opens a small form with three fields:
  - **Report link** (the inspectabike.com/report/... address)
  - **InspectABike inspection ID**
  - **Reference**
- Save updates the bike straight away. If an inspection ID is entered, VeloDealer then runs Refresh results automatically, so grade and faults come through from the corrected inspection.
- The change appears in the bike's activity history, showing the old and new values and who changed them.
- Blank fields are allowed (to unlink). The report link must be a valid web address. The ID can't be one already used by another bike in the same dealership.
- Mechanics and other staff don't see the button.

## Technical detail

- `src/components/bike/InspectionTask.tsx`: add `canEditLink = ['admin','owner'].includes(profile.role)`; a Dialog with `report_url`, `external_inspection_id`, `external_reference` inputs (zod: url or empty, trimmed strings ≤ 200).
- On save: check for a duplicate `external_inspection_id` among the business's other inspections; update the `inspections` row (create one for the bike if none exists); `logActivity` with kind `inspection`, action `link_edited`, and before/after values; if an ID is set, invoke `inspectabike-sync` for the bike and reload.
- Existing RLS on `inspections` already lets business admins update. No database or edge function changes.
