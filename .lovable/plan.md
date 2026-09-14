# Typeform response 1h012bp1tt4zsfipq1h012bwwst98ptb is missing

Confirmed just now: the submissions table is completely empty — that response is not stored, and the receiving function's log shows no incoming call at all (only start/stop entries). So Typeform never sent it to us; nothing was lost on our side.

The tools to fix and recover this are already live in Settings → Integrations.

## Steps

1. **Re-connect the notification.** On the "Sell or Exchange Your Bicycle" form, read the new status line. If it says anything other than "Confirmed live at Typeform", press "Re-connect notifications". If Typeform refuses, the exact reason is shown — report it back.
2. **Recover the missing response.** Press "Fetch recent responses". This pulls the last 25 responses straight from Typeform, including 1h012bp1tt4zsfipq1h012bwwst98ptb, and files them into the Submissions inbox using the field mapping already saved.
3. **Confirm end to end.** Submit one fresh test response. It should appear in Submissions within a few seconds without pressing anything.
4. **If step 3 still shows nothing**, I read the receiving function's log: it now records every call, including ones rejected for a bad signature. That tells us whether Typeform is calling us and being turned away, or not calling at all — and I fix accordingly.

## Fallback if Typeform will not register the notification

If step 1 keeps failing, the cause is the connected account's permission scope. In that case: disconnect Typeform, connect again (the sign-in now asks for the longer-lasting permission), then repeat steps 1–3. Step 2 still recovers every response submitted in the meantime, so nothing is lost while this is sorted.

## Technical notes

- Verified: `typeform_submissions` returns zero rows; `typeform-webhook` logs show no request events.
- Recovery path reuses the same extraction and `response_id` de-duplication as the webhook, so re-running it is safe and cannot create duplicates.
- No schema or code changes are proposed here — this is running and verifying what was deployed.
