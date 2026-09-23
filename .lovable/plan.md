# Make Refresh work from the report link

The report link works in a browser, but Refresh still says "Inspection not found". Refresh only asks InspectABike using the saved inspection ID and the bike reference. It never tries the number in the report link (9fc56de4-…). If Edit link saved that number as the ID, every lookup fails.

## Changes
1. **Refresh also tries the report link number.** It pulls the ID out of `inspectabike.com/report/<id>` and asks InspectABike by report ID, then by inspection ID. Whichever works is saved as the real inspection ID, so later refreshes go straight to the right record.
2. **Edit link is more forgiving.** Pasting the report link and leaving the ID blank is fine, because the ID is taken from the link. If a report number is typed into the ID box, it is stored as the report number, not the inspection ID.
3. **Clearer error.** If nothing matches, the message lists what was tried (inspection ID, report number, reference), so we can pass it straight to InspectABike.
4. **Log the lookups.** Every attempt and InspectABike's reply go into the function log, so the next failure can be pinned down right away.

## Check
After it's deployed, press Refresh results on BPS-GIA-5137. If InspectABike still can't find it by the report number, that confirms their partner lookup doesn't accept report numbers, and we'll ask them to support that.

## Technical
- `inspectabike-sync`: add `reportIdFromUrl(report_url)` (UUID regex after `/report/`). Attempts in order: `report_id=<fromUrl>`, `id=<extId>`, `report_id=<extId>`, `id=<fromUrl>`, `reference=…`, then de-dupe. Log each status. Persist `remote.id` as `external_inspection_id` (already done).
- `EditInspectABikeLinkDialog.tsx`: if the ID is empty or equals the URL's report UUID, don't overwrite `external_inspection_id` with the report UUID; rely on the sync to resolve it.
