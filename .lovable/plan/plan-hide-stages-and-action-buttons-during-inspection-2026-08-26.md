# Plan: Hide stages and action buttons during inspection

## Goal
When the bike detail view is opened from the inspection queue, hide the action buttons and the status progress stages so the mechanic only sees basic bike information and the inspection task.

## Changes

### `src/components/bike/BikeDetailView.tsx`
- Gate the header action buttons block (`Edit Bike`, `Copy listing`, `Break bike`, `Move back to...`, `Move to...`) so it is hidden when `inspectionMode === true`.
- Gate the `StatusProgressBar` at the top so it is hidden when `inspectionMode === true`.
- Keep the `Back to List` button, `Basic Information` card, and `InspectionTask` visible so mechanics can still perform inspections.

No database or other files need to change; `InspectionPage.tsx` already passes `inspectionMode={true}` into this component.
