# Typeform submission not arriving, plus checking backfilled inspection links

## Part 1 — Typeform submission didn't appear

### What I found

- The submissions list is genuinely empty: no submission has ever been saved.
- The form "Sell or Exchange Your Bicycle" is connected and switched on, with all nine
  fields mapped.
- The record of calls to our receiving address shows no incoming call from Typeform at
  all — not even a rejected one. So the response never reached us; it isn't being
  received and thrown away.

That points at the notification not actually being registered on the form at Typeform's
end (it was switched on at 00:31, shortly before the Typeform connection was repaired, so
it may have been set up while the connection was in its broken state). This is not yet
confirmed — confirming it is the first step below.

### What this does

1. **Show the real state.** In Settings → Integrations → Typeform, each form gains a
   status line read live from Typeform: registered and active, registered but off, or not
   registered — so the toggle reflects reality instead of just what we saved.
2. **Re-register on demand.** A "Re-connect notifications" button per form that re-creates
   the notification at Typeform and reports the result, with the error message shown
   plainly if Typeform refuses.
3. **Fail loudly when switching on.** Turning a form on currently saves our record even if
   Typeform rejects the request. That changes: if Typeform refuses, the toggle stays off
   and the reason is shown.
4. **Record every incoming call.** The receiver logs each call it gets — form, response,
   and whether it was accepted, rejected as unsigned, or ignored because the form is off.
   That makes the next "nothing showed up" answerable in seconds.
5. **Recover the response you just sent.** A "Fetch recent responses" button pulls the
   last responses for an enabled form directly from Typeform and files them into the
   submissions inbox, so the one you just submitted appears without re-doing it.

### Technical notes

- `typeform-oauth` gains actions `webhook_status` (`GET /forms/{id}/webhooks/{tag}`),
  `reregister_webhook` (re-`PUT` via `setTypeformWebhook`), and `fetch_responses`
  (`GET /forms/{id}/responses?page_size=25`), reusing the existing field map and the
  same insert path as the webhook so stored rows are identical; dedupe on `response_id`.
- `set_form_enabled` stops swallowing `setTypeformWebhook` failures — error propagates and
  the `typeform_forms` row is not flipped on.
- `typeform-webhook` adds `console.log` lines for received / signature-rejected /
  form-disabled / duplicate / inserted.
- `TypeformIntegration.tsx` shows the live status per form plus the two new buttons.

## Part 2 — Are the backfilled inspection links correct?

### What the records look like now

- 49 inspections; 48 have a link, and every one now reads
  `https://inspectabike.com/bike/report/<id>` — no "lovable" addresses left.
- Every link's ID matches the inspection ID stored on that record, and no two bikes share
  an inspection, so nothing is crossed or doubled up.
- BPS-CAN-8754 has no link — it was never sent to InspectABike.
- 9 linked inspections have no overall grade and 16 have no faults. That may be genuine,
  or it may mean the wrong record was matched.

Where a link was pasted in by hand, the backfill used that — those are reliable. Where
there was none, the bike was looked up by reference or frame number, and a bad match there
would attach the wrong inspection. Our own records can't tell the two apart anymore.

### What this does

1. **Verify each link against InspectABike** — compare the reference, make, model and frame
   number InspectABike holds against our bike.
2. **Report in three groups**: confirmed, mismatched (both sets of details shown), and dead
   links InspectABike no longer recognises.
3. **Refresh confirmed ones** — grade, inspector, stolen check and faults pulled in, filling
   the 9 missing grades if InspectABike has them.
4. **Unlink only on your say-so**, one click per bike, putting that bike back to "not sent".
5. **Flag BPS-CAN-8754** separately as never sent.

Runs from a new **Check links** button in the InspectABike card, admin and owner only.

### Technical notes

- New edge function `inspectabike-verify-links`, admin/owner only, reusing `iabFetch`,
  `normaliseFault`, `upsertFaults`, `syncBikeStatusFromFaults`, `rewriteReportUrl`.
- Per inspection `GET /partner-inspection?id=...`; 404 means dead link. Confirmed rows take
  the same update path as `inspectabike-sync`.
- Batched with `offset` / `limit` like `inspectabike-backfill`; UI loops until done.
- Unlink clears the external id, reference, report url, grade, inspector, stolen status and
  sync time, and removes imported faults that have no local decision.
- No schema changes in either part.
