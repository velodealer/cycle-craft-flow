# Fix Refresh after editing the InspectABike link

## What went wrong

From the logs for BPS-GIA-5137:
- The inspection ID was changed to `9fc56de4-…`, the number from the report link. InspectABike replies **"Inspection not found"** for that number. The report link uses a separate public number, not the inspection ID its system recognises. The ID saved before was `d1ba7161-…`.
- The screen only said "Edge Function returned a non-2xx status code" instead of InspectABike's actual message.
- Also important: the last successful Refresh (13:32, using the old ID) got back **zero faults**, and switched the badge to "no issues". So InspectABike's system is returning an inspection with no faults for this bike, while the report page shows issues. The faults may be on a second inspection that was started for the same bike.

## The fix

1. **Clear errors:** show InspectABike's real message (e.g. "Inspection not found in InspectABike — check the inspection ID") instead of the generic one, on both Refresh and the Edit link form.
2. **Accept a report link or ID:** in Edit link, if someone pastes the report link's number as the inspection ID, VeloDealer finds the inspection it belongs to and saves the right ID automatically. If it can't, it says so and saves nothing.
3. **Fall back to the reference:** if the saved ID isn't found, Refresh retries by the bike reference (BPS-GIA-5137) and uses the matching inspection, updating the saved ID.
4. **Don't wipe issues on an empty answer:** if InspectABike returns zero faults while the inspection previously had issues, keep the "issues found" state and warn "InspectABike returned no faults for this inspection" rather than silently switching to "no issues".
5. **Repair this bike:** restore the working ID for BPS-GIA-5137, try the reference lookup, and report back what InspectABike holds for it. If it truly returns no faults, that is on InspectABike's side and I'll give you the exact inspection IDs to raise with them.

## Technical detail

- `InspectionTask.tsx` / `EditInspectABikeLinkDialog.tsx`: on `FunctionsHttpError`, read `await error.context.json()` for the `error` field and show it.
- `inspectabike-sync`: on a 404 by `id`, retry `GET /partner-inspection?reference=<bike reference>`; accept `report_id`/report UUID by trying `?report_id=` then reference before failing; persist the resolved `external_inspection_id`. Log how many faults were received.
- Keep `has_issues` true when the remote fault list is empty but local issues were previously recorded; return a `warning` field that the UI shows as a toast.
- Redeploy `inspectabike-sync`. One data fix for this bike's inspection row (`external_inspection_id = 'd1ba7161-b518-4861-ae1a-93b9cffbc457'`).
