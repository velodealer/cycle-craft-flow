# Backfill existing inspections from InspectABike

## What's true today

- There are 48 inspection records. 47 already have a report link pasted in by hand, all in the form `https://inspectabike.com/report/<id>`.
- None of them are linked to InspectABike yet (no stored inspection ID), so grade, inspector, stolen check and faults were never pulled in.
- One inspection (BPS-CAN-8754, still in inspection) has no link at all.

## What this adds

1. **Link from the pasted report link.** The ID at the end of an existing report link is the InspectABike inspection ID. We read it from the link and store it, which turns every one of those 47 records into a properly connected inspection.
2. **Fall back to a search.** Where there is no link (or the link doesn't contain a usable ID), we look the bike up in InspectABike by its bike reference, then by its frame number. If nothing matches, that bike is reported as "not found" and left untouched.
3. **Pull the results.** For each linked inspection we fetch the current state: report link, overall grade, inspector, stolen check, and every fault with its parts and labour price. Faults are saved against the bike exactly as they are for new inspections, so they appear on the bike's inspection panel awaiting approval.
4. **Set the bike's stage.** Bikes with open faults sit in Awaiting Approval; bikes whose faults are all repaired or declined move to Ready for Sale. Bikes already sold, listed or otherwise past inspection are never moved.
5. **Costs stay manual.** Backfilled faults are imported as reported, not approved — nobody's costs change until an admin or owner approves a fault, same as now.

## Where you run it

A new **Backfill from InspectABike** button in Settings, next to the other integration settings, visible to admin and owner only. It runs over every bike with an inspection record, shows progress, and finishes with a summary: linked, faults imported, already linked, not found, failed. It is safe to run more than once — re-running just refreshes.

The existing per-bike Refresh results button also starts working on these bikes once they're linked.

## Technical notes

- New edge function `inspectabike-backfill`, admin/owner only, reusing `_shared/inspectabike.ts` (`iabFetch`, `normaliseFault`, `syncBikeStatusFromFaults`).
- Resolution order per inspection: existing `external_inspection_id` → UUID parsed from `report_url` (`/report/<uuid>`) → `GET /partner-inspection?reference=<bike.reference>` → `?serial=<bike.frame_number>`. First success wins and is written to `external_inspection_id` / `external_reference`.
- Fetches `GET /partner-inspection?id=...`, updates `inspections` (report_url, overall_grade, inspector_name, stolen_status, has_issues, status/completed_at when remote is complete, synced_at) and upserts faults on `external_fault_id` — identical to `inspectabike-sync`, so behaviour stays consistent.
- Processes in batches (accepts optional `bike_ids` / `limit` and an offset cursor) so a large run doesn't hit the function timeout; the Settings UI loops until done. Per-inspection failures are collected and returned, never aborting the run.
- No schema changes.
