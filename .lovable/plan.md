# Check the backfilled inspection links are correct

## What the records look like right now

- 49 inspections in total. 48 have a report link, and every one now reads
  `https://inspectabike.com/bike/report/<id>` — no "lovable" addresses left.
- Every link's ID matches the inspection ID stored against that record, so no link
  points somewhere different to what the record says.
- No two bikes share the same inspection ID, so nothing is doubled up.
- One bike, BPS-CAN-8754, has no inspection link at all — it was never sent to
  InspectABike and is still shown as in progress.
- 9 linked inspections came back with no overall grade, and 16 have no faults recorded.
  That may be genuine (clean bike, no grade given), or it may mean the wrong record was
  matched.

## What can't be confirmed from our side

When the links were backfilled, most were taken from the address someone had pasted in by
hand — those are reliable. Where there was no pasted link, the bike was looked up in
InspectABike by its reference or frame number, and a bad match there would attach the
wrong inspection to a bike. Our own records can't tell those two cases apart anymore.

## What this does

1. **Verify every link against InspectABike.** For each linked inspection, ask
   InspectABike for that inspection and compare what comes back — bike reference, make,
   model and frame number — against the bike on our side.
2. **Report, don't silently change.** Results come back in three groups:
   - Confirmed: InspectABike agrees it's the same bike.
   - Mismatched: InspectABike returns a different bike — the link is listed with both
     sets of details so you can decide.
   - Missing: InspectABike has no record for that ID (dead link).
3. **Refresh while we're there.** For confirmed links, pull the current grade, inspector,
   stolen check and faults, so the 9 missing grades and any missing faults fill in if
   InspectABike actually has them.
4. **Unlink on your say-so.** Any mismatched or dead link can be cleared with one click
   per bike, which puts that bike back to "not sent to InspectABike" so it can be
   relinked or re-sent properly. Nothing is unlinked automatically.
5. **BPS-CAN-8754** is flagged separately as never sent, with a link to its bike page.

## Where you run it

In Settings → Integrations → InspectABike, next to the existing backfill button: a new
**Check links** button, admin and owner only. It works through the inspections in batches,
shows progress, and finishes with the three lists above. Safe to run as often as you like.

## Technical notes

- New edge function `inspectabike-verify-links`, admin/owner only, reusing `iabFetch`,
  `normaliseFault`, `upsertFaults`, `syncBikeStatusFromFaults` and `rewriteReportUrl`
  from `_shared/inspectabike.ts`.
- Per inspection: `GET /partner-inspection?id=<external_inspection_id>`. Compare
  `reference` / `serial_number` / make / model from the response against the joined
  `bikes` row; 404 means dead link. Confirmed rows get the same update path as
  `inspectabike-sync`, so behaviour stays identical.
- Batched with `offset` / `limit` and a cursor, same shape as `inspectabike-backfill`,
  so the UI loops until done and one slow record can't time out the run.
- Unlink action clears `external_inspection_id`, `external_reference`, `report_url`,
  `overall_grade`, `inspector_name`, `stolen_status`, `synced_at`, and removes the faults
  imported for that inspection that have not been decided locally.
- No schema changes.
