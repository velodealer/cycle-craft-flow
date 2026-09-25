# Reconcile bike and dashboard counts

## What is happening

- **74 on Bikes** counts every bike record: **71 active**, **1 sold**, and **2 split for parts**.
- **71 bikes in the book** intentionally counts active bikes only.
- The live active status totals are: **2 intake + 2 cleaning + 20 inspection + 4 owner approval + 24 repair + 19 ready = 71**.
- The Repair card shows only **16** because it counts bikes with open workshop jobs, not all 24 bikes whose stage is Repair.
- The missing eight bikes have approved inspection faults but no workshop job. The approval function currently creates a job only when labour cost is above zero, and it does not surface a failed job insert. Six of the affected approvals have £0 labour; two have positive labour but their historical failure cannot be proven from the remaining data.
- The screenshot’s Owner approval count of 5 is stale; the current database count is 4.

## Plan

1. **Use one stage-count definition**
   - Keep “Bikes in the book” as active bikes only.
   - Make each stage card represent the bike’s current workflow stage, so the visible stage cards add up to the 71 active bikes.
   - Keep the open repair-job count as secondary text on the Repair card.

2. **Prevent bikes falling between Repairs and Jobs**
   - When all repair decisions are complete, create one workshop job for every approved repair requiring action, including approvals with £0 labour.
   - Treat parts-only or zero-cost work as valid jobs rather than silently omitting the bike.
   - Surface and log any job or part creation error instead of allowing approval to appear successful with missing work.

3. **Recover the eight affected bikes safely**
   - Backfill only approved faults that have no linked workshop job.
   - Make the recovery idempotent so existing jobs cannot be duplicated.
   - Preserve declined repairs and existing bike stages.

4. **Verify the full workflow**
   - Confirm the active stage cards sum to the “bikes in the book” total.
   - Confirm all 24 Repair-stage bikes appear on Jobs after their decisions are complete.
   - Test approve, decline, undo, zero-cost repair, paid repair, and duplicate prevention.

## Technical notes

- Centralise active-stage grouping instead of mixing bike status, fault rows, and job rows for headline card counts.
- Keep job counts operational and separate from bike-stage counts.
- Add a database-safe uniqueness/idempotency guard around fault-to-job creation before backfilling.
