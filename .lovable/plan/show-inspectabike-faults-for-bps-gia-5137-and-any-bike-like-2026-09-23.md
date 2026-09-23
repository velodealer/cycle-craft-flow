# Show InspectABike faults for BPS-GIA-5137 (and any bike like it)

## What is going wrong

Checked the records for this bike (BPS-GIA-5137):
- The inspection is marked completed with issues found, and the bike is on "Awaiting approval".
- But **no faults are saved** against it, so the fault panel and the Repairs page have nothing to show.
- The last Refresh (13:23) did receive faults from InspectABike — that is what set "issues found" — and there was no database error. So the faults were thrown away before saving. The only step that does that is where we pick out each fault's ID: any fault without an `id` or `fault_id` field is silently dropped. InspectABike is most likely sending the fault ID under a different name (or nested) for this inspection. The exact field name is still to be confirmed from the live response.

**Why the live updates didn't catch them either:** yes, they should. But no live update from InspectABike has reached VeloDealer in the last two days. This dealer's InspectABike account shows as connected, yet no signing key was saved for it when it connected, and nothing tells InspectABike where to send updates for this account. So InspectABike is either not sending them or sending them somewhere else.

## The fix

1. Pull this inspection's live response once and record exactly how InspectABike names the fault ID and fields.
2. Read the fault ID from every name InspectABike uses (including nested forms). If a fault truly has no ID, build a stable one from the inspection and the fault's position/title so it is never lost.
3. Never drop faults silently again: if any are skipped, Refresh shows a clear message instead of a silent success.
4. Apply the same reading to the live webhook updates so faults arriving that way are not lost either.
4a. Make live updates actually arrive per dealer: when a dealer connects InspectABike, register VeloDealer's update address with their account and save the signing key it returns. If InspectABike's connection doesn't support that, fall back to our shared key and show a "Live updates: not receiving" warning on the integration card, with a Re-register button.
4b. Safety net: while a bike is awaiting inspection results, automatically refresh it from InspectABike every 15 minutes, so faults appear even if a live update is missed.
5. Refresh BPS-GIA-5137 and check its faults appear on the bike page and on the Repairs page, then re-sync any other bike that shows "issues found" with no faults.

## Technical detail

- `normaliseFault` in `supabase/functions/_shared/inspectabike.ts`: id fallback chain `id ?? fault_id ?? uuid ?? external_id ?? fault?.fault?.id`; titles/costs likewise accept nested/alternate keys found in step 1. Deterministic fallback id = `${external_inspection_id}:${index}` when absent.
- `inspectabike-sync`: log the count of received vs saved faults; return an error to the UI when saved < received. Keep `has_issues` in line with saved rows.
- `inspectabike-webhook`: same normaliser, so no separate change beyond redeploy.
- Redeploy `inspectabike-sync`, `inspectabike-webhook`, `inspectabike-decision`, `inspectabike-undo-decision`.
- Backfill: find inspections with `has_issues = true` and zero fault rows, and run a sync for each.
- No UI or database schema changes.
