# Move all fully-deferred bikes to Ready for Sale

There are 32 bikes sitting in Repair whose only open jobs are deferred ones. You want them all moved to Ready for Sale in one go, with the deferred jobs staying open on the Jobs page so the workshop can do them while the bikes are listed — and they still must be finished before handover.

## What changes

- A new **"Move deferred bikes to Ready"** button on the Jobs page (owners/admins only), next to Defer all.
- Pressing it shows a confirmation listing the affected bikes: every bike in Repair where all open repair jobs are deferred.
- Confirming moves all of them to **Ready for Sale** at once. Each move is recorded in the bike's history ("Moved to Ready for Sale with N deferred jobs").
- The deferred jobs stay open and visible on the Jobs page exactly as they do now — mechanics can pick them up any time, and the existing rules still apply: sold bikes with deferred work jump to the top with the "Sold – before handover" badge, and courier booking / marking collected or delivered is blocked until they're done (owner/admin override with a reason).
- If any of those bikes are already listed on eBay/Shopify, nothing changes there — the listings stay as they are. (Auto-listing is currently paused, so nothing will be pushed automatically.)

## Technical notes

- `src/pages/JobsPage.tsx`: new button + confirmation dialog. Query bikes with status `repair` that have at least one open deferred workshop job and no open non-deferred workshop job; bulk-update their status to `ready` and log one `status_change` activity entry per bike.
- No database changes — the `ready` status and the deferred-job gates already exist.
- No change to the per-bike Advance stage flow; this is an additional bulk action.
