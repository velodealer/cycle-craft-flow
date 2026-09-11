# Fix Refresh results and stuck repair statuses

## What is going wrong

Confirmed from the function logs and the database:

- **Refresh results fails every time.** The refresh saves all the faults it pulls back in one go. Faults already known here carry their internal row id, brand-new ones don't — and the database rejects the whole batch because of that mix. So nothing at all is saved: no new faults, no "Repaired" updates, and you see the edge function error.
- **Repaired does show** when InspectABike sends its live update — three bikes (BPS-SPE-009R, BPS-TRE-1358, BPS-WIL-3976) are marked Repaired and already moved to Ready for sale. Bikes that only ever got their updates through Refresh are still stuck, because Refresh has never succeeded.
- **Bikes not moving on.** BPS-BMC-00NA (all 3 faults approved), BPS-RIB-1641-2 (1 approved) and BPS-CAN-2927 / BPS-CAN-0304 (all decided) are still on "Awaiting approval". Their decisions were made before the new movement rule existed, and nothing recalculates a bike's stage after the fact.

## The fix

1. Save faults in a way the database accepts, so Refresh works: new faults appear, and faults marked repaired on InspectABike come through with their completion time and close off the matching workshop job.
2. Recalculate each bike's stage after a refresh, so a bike whose faults are all approved moves to Repair and one with everything repaired or declined moves to Ready for sale.
3. One-off recalculation across the existing bikes so the ones listed above land on the right stage straight away.

## Technical detail

- `upsertFaults` in `supabase/functions/_shared/inspectabike.ts`: PostgREST unifies the column set across a batch, so rows without an `id` key are sent as explicit `null` and hit the `inspection_faults.id` not-null constraint. Assign `crypto.randomUUID()` to rows with no existing match (keeping the matched row's id) so every row in the batch carries an id. Conflict target stays `external_fault_id`.
- Redeploy `inspectabike-sync`, `inspectabike-webhook`, `inspectabike-decision`, `inspectabike-undo-decision` (all share the helper).
- Backfill: a script/SQL pass applying the existing status rule (`reported` -> pending_approval, else `approved`/`awaiting_part` -> repair, else completed inspection -> ready) to every bike currently in `inspection`/`pending_approval`/`repair`.
- No UI changes: `InspectionFaults.tsx` and `RepairsPage.tsx` already render the Repaired badge and completion time.
