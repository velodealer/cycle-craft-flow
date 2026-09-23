# Fix "Could not start inspection"

## What I found
- Good news: the InspectABike signing key was saved at 15:10. The connection is healthy and live updates are ready.
- Every press of "Start inspection" since 15:05 was rejected by InspectABike when VeloDealer asked it to create the inspection.
- InspectABike's reason is being lost. Their error comes back in a format we don't read, so our record only says "[object Object]" and your screen shows the generic "non-2xx" message.
- The exact reason isn't known yet. The first step is to capture it.

## What to build
1. **Show InspectABike's real reason.** Read their error properly, including nested messages and lists of field problems, so the toast says exactly what they objected to, for example a missing or invalid field.
2. **Record the full reply** in our error log, so I can see exactly what they sent back.
3. **Use the same reader** on every InspectABike action: start, refresh, edit link and mark repaired. Any failure then shows the real message.
4. **Fix the cause once it's visible.** After your next press, I'll read the log and correct whatever InspectABike rejects. A likely suspect is a duplicate reference or frame number (for example, a bike already inspected), or a value format they now enforce. If it's a duplicate, VeloDealer will link the bike to the existing inspection instead of failing.

## Technical
- _shared/inspectabike.ts iabFetch: build the message with a `errText(body)` helper that handles `error` as a string or `{message, code, details}`, and handles `errors[]` / `message`. Attach `body`. Log `JSON.stringify(body).slice(0,1000)` with the status and path.
- inspectabike-create: log via the same helper. Return `{ error, details }`. On 409/duplicate responses, reuse `inspection_id` / `report_url` from the body when present.
- InspectionPage.tsx and InspectionTask.tsx: use `functionErrorMessage(error, data)` instead of `error.message`.
- Redeploy the inspectabike-create, inspectabike-sync and inspectabike-complete-repair functions.
