Simplify the inspection dialog so it only displays the bike's basic information and the inspection task card.

## Current State

The inspection flow opens a full `BikeDetailView` inside a dialog on `InspectionPage.tsx`. The dialog already suppresses Photos, Pricing, and Descriptions, but still renders the `BikeSpecificationSection` and `CollectionStatus` task cards alongside the `InspectionTask`. This creates clutter for a mechanic who just needs to start/complete an inspection.

## Proposed Change

1. Add a new `inspectionMode` boolean prop to `BikeDetailView`.
2. When `inspectionMode` is true, render only:
   - Header / back button
   - Status progress bar
   - Basic Information card
   - Inspection task card
   - Hide: BikeSpecificationSection, BikeCostsSection, Pricing & Finance, Photos, Descriptions, Investor card, and CollectionStatus.
3. Update `InspectionPage.tsx` to pass `inspectionMode={true}` to `BikeDetailView` inside the inspection dialog.

## Files to Edit

- `src/components/bike/BikeDetailView.tsx`: add `inspectionMode` prop and gate the non-essential sections.
- `src/pages/InspectionPage.tsx`: pass `inspectionMode={true}` to the dialog's `BikeDetailView`.

## UI/UX Notes

- Keep the status progress bar so the mechanic still sees where the bike is in the workflow.
- Keep the header action buttons (Move forward/back, Edit) as they are already part of `BikeDetailView` and useful during inspection.
- No database changes required.
