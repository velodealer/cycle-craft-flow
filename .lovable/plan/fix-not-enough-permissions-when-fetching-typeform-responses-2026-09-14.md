# Fix "not enough permissions" when fetching Typeform responses

Good news first: the "Sell or Exchange Your Bicycle" form now shows **Confirmed live at Typeform**, so the notification is properly set up — new submissions from now on should land in the Submissions inbox on their own.

The error on "Fetch recent responses" is separate. When you signed in to Typeform, we only asked for permission to read your forms and manage notifications — we never asked for permission to read submitted responses. Typeform therefore refuses that one request with "not enough permissions". Confirmed in the code: the permission list we request is forms, notifications and long-lived access, with reading responses missing.

## Fix

1. Add "read responses" to the permissions we request when connecting Typeform.
2. Because permissions are granted at sign-in, the existing connection still lacks it. After the change, press **Disconnect**, then **Connect Typeform** and approve again — the approval screen will now include reading responses.
3. Then **Fetch recent responses** works and will pull in the submission with response id `1h012bp1tt4zsfipq1h012bwwst98ptb` along with anything else already submitted.
4. Make the error clearer: if Typeform refuses for this reason again, show "Typeform has not granted permission to read responses — disconnect and connect again" rather than the raw code.
5. Finally, submit one fresh test response to confirm it arrives automatically, with no button press.

## Technical notes

- `typeform-oauth/index.ts` line 140: add `responses:read` to the `scope` string used for the authorize URL.
- `fetch_responses` catches a Typeform 403 and returns the friendlier reconnect message; `webhook_status` keeps its current behaviour.
- Redeploy `typeform-oauth`. No schema or database changes.
