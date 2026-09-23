# Open unfinished InspectABike reports on the edit screen

## What changes
When someone opens an InspectABike report, VeloDealer checks whether the inspection is finished yet.
- **Not finished yet:** the link goes to InspectABike's edit screen (`inspectabike.com/inspection/<id>`) so the mechanic can carry on with the inspection.
- **Finished:** the link opens the finished report, as it does today.

This applies everywhere a report opens:
- "Start inspection" on the Inspections page. A new inspection is never finished, so this always goes to the edit screen.
- "Open inspection report" and the report link in the bike's inspection box. The label changes to "Continue inspection" while it's unfinished.

## Technical details
- New helper `inspectionOpenUrl(inspection)` in `src/services/inspectabike.ts`:
  - If the status is `completed`, return `report_url`.
  - Otherwise, take the ID from the report URL (`/report/<uuid>`) or fall back to `external_inspection_id`, then return `https://inspectabike.com/inspection/<id>`. The InspectABike address is kept in one constant.
- `InspectionPage.tsx` `handleStart` uses the helper on the returned inspection.
- `InspectionTask.tsx` uses the helper for both links and switches the label depending on whether the inspection is finished.
