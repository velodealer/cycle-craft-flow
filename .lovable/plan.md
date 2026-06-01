# Add Move Back button

Add a secondary button next to "Move to {nextStage}" on the bike detail view that reverts the bike to the previous workflow stage.

## Changes

**`src/components/bike/BikeDetailView.tsx`**
- Add `getPreviousStage(currentStatus)` mirroring `getNextStage`, walking the same combined stage list (collection stages + standard stages) in reverse.
- Render a `Move back to {label}` button (variant `outline`, `ArrowLeft` icon) in the header action row, shown only when a previous stage exists.
- Reuse `AdvanceStageDialog` for the revert action — pass the previous stage as `nextStage` and a custom `nextStageLabel` like `"{label} (revert)"`. The dialog already updates `bikes.status` to whatever stage it's given, so no logic change is needed there.
- Track which dialog is open with a small state (`'forward' | 'back' | null`) so the same component instance can serve both directions.

## Out of scope
- No DB changes.
- No audit log of reverts (existing `AdvanceStageDialog` doesn't record stage transitions either).
- Dialog copy stays generic ("Move to X"); only the trigger button is labelled "Move back".
