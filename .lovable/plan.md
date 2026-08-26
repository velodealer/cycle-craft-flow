# Inspection Queue

Add an Inspection page mirroring the Cleaning queue, plus a per-bike inspection record with an external inspectabike.com link and an outcome that routes the bike to Awaiting Approval or Ready for Sale.

## What the user sees

1. **New "Inspection" item in the sidebar** (admin + mechanic), route `/inspection`.
2. **Queue table** listing every bike with status `inspection`: bike, frame number, date entered, and a "Start / continue inspection" action.
3. **Inspection record panel** (opens for the selected bike):
   - "Open inspectabike.com" button (opens the site in a new tab).
   - "Inspection report URL" field for the mechanic to paste the link back in, with Save.
   - Notes field.
   - A checkbox/toggle: "Issues found — needs approval".
   - "Complete inspection" button:
     - issues toggle on -> bike status becomes **Awaiting Approval** (`pending_approval`)
     - issues toggle off -> bike status becomes **Ready for Sale** (`ready`)
   - Completed inspections stay visible on the bike detail page (read-only summary with a link to the report).

## Data

New table `public.inspections`:
- `bike_id` (references bikes), `report_url`, `notes`, `has_issues` (boolean, default false), `status` (`in_progress` / `completed`), `inspected_by` (profile), `started_at`, `completed_at`, timestamps.
- Grants for `authenticated` + `service_role`; RLS: staff (admin, mechanic, detailer, accountant, owner) can read; admin/mechanic can create and update. Investors excluded.
- `updated_at` trigger.

## Technical notes

- Files: new `src/pages/InspectionPage.tsx` (queue, patterned on `CleaningPage.tsx`), new `src/components/bike/InspectionTask.tsx` (the record panel, patterned on `CleaningTask.tsx` with auto-create on open).
- Route registered in `src/App.tsx` under `InvestorGuard` + `Layout`; nav entry added to `src/components/AppSidebar.tsx` with roles `['admin', 'mechanic']`.
- `InspectionTask` rendered inside the bike detail view so the record is reachable from `/bikes/:id` too.
- Status transitions use the existing `bike_status` enum values (`inspection`, `pending_approval`, `ready`) — no enum change needed.
- Report URL validated as an http(s) URL before saving.
