## Problem

When clicking **Move to {next stage}** on the bike detail page, the database update succeeds, but the UI doesn't reflect the change. The page appears frozen on the same status.

Root cause is in `src/pages/BikesPage.tsx`:
- `BikeDetailView` is rendered from `selectedBike` (a stale object stored when the user clicked the bike in the list).
- `AdvanceStageDialog` updates the `bikes` row in Supabase and calls `onUpdate` (→ `handleUpdate`).
- `handleUpdate` only bumps `refreshKey` (which re-mounts the hidden `BikeList`); it never refetches the open bike or updates `selectedBike`. The comment in the file even flags this as a TODO.

So the detail view keeps showing the old `status`, the progress bar doesn't move, and the "Move to …" button still shows the previous next stage.

## Fix

Refetch the selected bike from Supabase after a successful stage advance and replace `selectedBike` with the fresh row. The detail view will then re-render with the new status, updated progress bar, and the correct next-stage button.

### Files Changed

- `src/pages/BikesPage.tsx` — In `handleUpdate`, when `selectedBike` exists, query `bikes` by `selectedBike.id`, set the result into `selectedBike`. Keep the existing `refreshKey` bump so the list view stays in sync when the user returns.

No schema, RLS, or dialog-side changes are needed — `AdvanceStageDialog` already writes the new status and calls `onSuccess`.
