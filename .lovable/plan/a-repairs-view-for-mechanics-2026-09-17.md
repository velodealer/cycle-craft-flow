# A repairs view for mechanics

Today the Repairs page is an approval screen for admins and owners only — mechanics can't open it, and there is no way to tick a repair off in VeloDealer (repairs only turn green when InspectABike tells us). This adds a mechanic's working view.

## What changes

**Mechanics get the Repairs page.** It appears in their menu and opens on their own work list.

**A "My work" view** showing only approved and awaiting-part repairs, grouped by bike, so a mechanic can work through a whole bike in one place — no need to open each bike individually. Each bike shows its photo, ID, make/model, size, colour and bay, and each repair shows the fault, the part it affects, the description and any note left with the approval.

**No prices for mechanics.** Parts, labour and total figures, the approval totals and the "View costing" button are hidden for the mechanic role. Admins and owners see everything exactly as they do now.

**Mark a repair as done.** Each repair gets a "Mark repaired" button. Tapping it tells InspectABike the repair is complete, then marks it repaired here, stamps the time and closes the linked workshop job. If InspectABike refuses the update, nothing changes locally and the mechanic sees a plain message explaining that it couldn't be recorded — so the two systems never disagree.

**A bike-level "Mark all repaired"** button to finish every outstanding repair on a bike in one tap, with a confirm step.

**Bikes still move themselves.** Once every repair on a bike is repaired or declined, the bike moves on to Ready as it does today — no extra step for the mechanic.

Admins and owners keep the existing tabs (Awaiting approval, All open, All), the approve/decline controls, the undo button and the costing dialog, and also gain the same "Mark repaired" action.

## Technical notes

- `src/components/AppSidebar.tsx`: add `mechanic` (and `detailer` excluded) to the Repairs entry roles.
- `src/pages/RepairsPage.tsx`: add a role-derived `isMechanic`. For mechanics, force the filter to a new `assigned`/approved set (`approved`, `awaiting_part`), hide the tab bar, hide all `fmt(...)` cost spans, the pending/approved totals row and the costing button; keep search and grouping. Admins keep the current tabs plus a fourth "To repair" tab using the same status set.
- New edge function `inspectabike-complete-repair` (modelled on `inspectabike-decision`): roles `admin`, `owner`, `mechanic`; validates `fault_row_id`; calls `POST /partner-fault-decision` with `{ fault_id, decision: 'repaired', actor_name }` via `iabFetch`. On a non-2xx response it returns the error and makes no local change. On success it sets `status: 'repaired'`, `repaired_at`, records the acting profile, completes `jobs` row `fault.job_id` (`status: 'completed'`, `completed_at`), then calls `syncBikeStatusFromFaults` so the bike advances to `ready` when all faults are settled.
  - If the partner endpoint rejects `repaired` as a decision value, the function retries once against `/partner-fault-repaired` before surfacing the error; whichever shape InspectABike accepts is what gets used.
- `supabase/config.toml`: no `verify_jwt` change — the function is authenticated like the other decision functions.
- Bulk action calls the same function per outstanding fault sequentially, reporting how many succeeded.
- RLS: `inspection_faults` and `jobs` are written by the edge function under the service role, so no policy change is required; mechanics already have read access to `inspection_faults` and `bikes`.
