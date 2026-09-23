# Marking a job done should tell InspectABike

Today, pressing "Done" on the Jobs page only updates the job inside VeloDealer. If that job belongs to an InspectABike fault, the fault stays open on InspectABike's side, the bike doesn't advance, and the two systems disagree. Only the "Mark repaired" button on the Repairs page tells InspectABike today.

## What changes

**Marking a job done syncs to InspectABike.** When a job that belongs to an approved fault is marked done on the Jobs page, VeloDealer now tells InspectABike the repair is complete first — the same flow the Repairs page uses. If InspectABike accepts, the fault is marked repaired here, the job is stamped done, and the bike advances to Ready when its last fault is settled. If InspectABike refuses, nothing changes locally and the mechanic sees a plain-English message, so the two systems never disagree.

**Jobs with no InspectABike fault behave exactly as now** — cleaning, detailing and manually added jobs just get marked done locally.

**Mixed done-states cleaned up.** Jobs completed through the InspectABike flow are recorded as "completed", while the Jobs page screens use "complete". Both spellings will count as done everywhere on the Jobs page so nothing shows in the wrong tab.

## Technical notes

- `src/pages/JobsPage.tsx`: in `update()`, when the patch sets done status, first look up an open fault (`inspection_faults`, `job_id = job.id`, status not `repaired`/`declined`). If one exists, invoke the existing `inspectabike-complete-repair` edge function with `fault_row_id` instead of updating `jobs` directly — that function already marks the fault repaired, completes the linked job and calls `syncBikeStatusFromFaults` to advance the bike. On error, surface it via `functionErrorMessage()` from `src/services/inspectabike.ts` and leave the job untouched.
- Status normalisation in the same file: treat `completed` the same as `complete` in the filter logic, status label and badge variant.
- No edge function changes — `inspectabike-complete-repair` already accepts `admin`, `owner` and `mechanic`, rejects declined faults and is idempotent for already-repaired faults.
- No database or RLS changes.
