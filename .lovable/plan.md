# Fix "Start inspection" and ask for missing bike details

## What goes wrong
InspectABike wants the bike's year as text (for example "2020"). VeloDealer sends it as a number, so InspectABike turns the request down with a confusing message.

## What changes
1. **Fix the year problem.** The year is sent as text, so the Cervélo starts straight away.
2. **Ask for missing details before sending.** When you press "Start inspection", VeloDealer checks that the bike has what InspectABike needs: make, model, frame/serial number and bike type. The year is optional. If anything is missing, a small form opens showing only the missing boxes. You fill them in and press "Save & start". The details are saved on the bike, then the inspection is sent.
3. **Handle refusals the same way.** If InspectABike still rejects a field (for example "bike_year" or "serial_number"), VeloDealer doesn't just show a red error. It opens the same form with that box highlighted and InspectABike's reason in plain words underneath, so you can fix it and try again.
4. This works on both the Inspections page and the bike's own inspection box.

## Technical details
- `inspectabike-create`: `bike_year: bike.year ? String(bike.year) : null`, trim strings, send `null` rather than empty strings. Check required fields before calling InspectABike; if any are missing, return 422 `{ code: 'MISSING_FIELDS', fields: [...] }`. When InspectABike returns a field-error map (`{field: [msg]}`), return 422 `{ code: 'INVALID_FIELDS', fields: [{field, message}] }`. Map InspectABike names back to bike columns (bike_year→year, serial_number→frame_number, bike_make→make, bike_model→model, bike_type→bike_type).
- New `MissingBikeInfoDialog.tsx`: renders inputs only for the flagged fields (year uses a 4-digit number input, bike type uses a select), validated with zod. On save it updates `bikes`, logs an activity entry, then calls `inspectabike-create` again.
- `InspectionPage.tsx` and `InspectionTask.tsx`: read the 422 body through `functionErrorMessage`/context, open the dialog if it matches, otherwise show the toast as now.
- Redeploy `inspectabike-create`.
