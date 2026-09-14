# Typeform submission not arriving

## What I found

- The submissions list is genuinely empty: no submission has ever been saved.
- The form "Sell or Exchange Your Bicycle" is connected and switched on, with all nine
  fields mapped.
- The record of calls to our receiving address shows no incoming call from Typeform at
  all — not even a rejected one. So the response never reached us; it isn't arriving and
  being thrown away.

That points at the notification not actually being registered on the form at Typeform's
end. It was switched on at 00:31, shortly before the Typeform connection was repaired, so
it was likely set up while the connection was still broken and silently failed. Not yet
confirmed — confirming it is the first step below.

## What this does

1. **Show the real state.** In Settings → Integrations → Typeform, each form gains a status
   line read live from Typeform: registered and active, registered but off, or not
   registered — so the toggle reflects reality instead of just what we saved.
2. **Re-register on demand.** A "Re-connect notifications" button per form that re-creates
   the notification at Typeform and reports the result, showing Typeform's own message
   plainly if it refuses.
3. **Fail loudly when switching on.** Turning a form on currently saves our record even if
   Typeform rejects the request. That changes: if Typeform refuses, the toggle stays off
   and the reason is shown.
4. **Record every incoming call.** The receiver logs each call it gets — form, response, and
   whether it was accepted, rejected as unsigned, or ignored because the form is off. That
   makes the next "nothing showed up" answerable in seconds.
5. **Recover the response you just sent.** A "Fetch recent responses" button pulls the latest
   responses for an enabled form straight from Typeform and files them into the submissions
   inbox, so the one you just submitted appears without re-doing it.

## Technical notes

- `typeform-oauth` gains actions `webhook_status` (`GET /forms/{id}/webhooks/{tag}`),
  `reregister_webhook` (re-`PUT` via `setTypeformWebhook`), and `fetch_responses`
  (`GET /forms/{id}/responses?page_size=25`), reusing the existing field map and the same
  insert path as the webhook so stored rows are identical; dedupe on `response_id`.
- `set_form_enabled` stops swallowing `setTypeformWebhook` failures — the error propagates
  and the `typeform_forms` row is not flipped on.
- `typeform-webhook` adds `console.log` lines for received / signature-rejected /
  form-disabled / duplicate / inserted.
- `TypeformIntegration.tsx` shows the live status per form plus the two new buttons.
- No schema changes.
