# Show InspectABike faults for BPS-GIA-5137 (and any bike like it)

## What is going wrong

Checked the records for this bike (BPS-GIA-5137):
- The inspection is marked completed with issues found, and the bike is on "Awaiting approval".
- But **no faults are saved** against it, so the fault panel and the Repairs page have nothing to show.
- The last Refresh (13:23) did receive faults from InspectABike — that is what set "issues found" — and there was no database error. So the faults were thrown away before saving. The only step that does that is where we pick out each fault's ID: any fault without an `id` or `fault_id` field is silently dropped. InspectABike is most likely sending the fault ID under a different name (or nested) for this inspection. The exact field name is still to be confirmed from the live response.

## The fix

1. Pull this inspection's live response once and record exactly how InspectABike names the fault ID and fields.
2. Read the fault ID from every name InspectABike uses (including nested forms). If a fault truly has no ID, build a stable one from the inspection and the fault's position/title so it is never lost.
3. Never drop faults silently again: if any are skipped, Refresh shows a clear message instead of a silent success.
4. Apply the same reading to the live webhook updates so faults arriving that way are not lost either.
5. Refresh BPS-GIA-5137 and check its faults appear on the bike page and on the Repairs page, then re-sync any other bike that shows "issues found" with no faults.

## Technical detail

- `normaliseFault` in `supabase/functions/_shared/inspectabike.ts`: id fallback chain `id ?? fault_id ?? uuid ?? external_id ?? fault?.fault?.id`; titles/costs likewise accept nested/alternate keys found in step 1. Deterministic fallback id = `${external_inspection_id}:${index}` when absent.
- `inspectabike-sync`: log the count of received vs saved faults; return an error to the UI when saved < received. Keep `has_issues` in line with saved rows.
- `inspectabike-webhook`: same normaliser, so no separate change beyond redeploy.
- Redeploy `inspectabike-sync`, `inspectabike-webhook`, `inspectabike-decision`, `inspectabike-undo-decision`.
- Backfill: find inspections with `has_issues = true` and zero fault rows, and run a sync for each.
- No UI or database schema changes.
