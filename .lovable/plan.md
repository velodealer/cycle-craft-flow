# Wire in the new InspectABike signing secret

## Answer to the question

Disconnect + reconnect will **not** damage existing inspections:

- Disconnect only deletes the connection record (tokens + stored signing secret).
- Inspections and faults live in their own tables and stay exactly as they are. They match to InspectABike by their external inspection IDs, which don't change on reconnect.

One catch: reconnect only picks up the new signing secret **if InspectABike returns it inside the OAuth token response**. We can't know that until we try. There is a simpler path that involves no disconnect at all (step 1 below).

## Plan

1. **Store the secret without disconnecting (preferred).**
   - The webhook checker already accepts a platform-wide signing secret as a fallback for every dealer.
   - Open a secure form for the user to paste the signing key InspectABike issued; save it over the existing `INSPECTABIKE_WEBHOOK_SECRET` value.
   - Live updates then start working immediately for this dealer; no reconnect, no risk.

2. **Show live-update status on the InspectABike card** (`InspectABikeIntegration.tsx`).
   - The connection status call already reports whether a per-dealer signing secret is stored.
   - Add a small line on the card: "Live updates: on" when a secret is held (per dealer or platform-wide), "Live updates: not receiving — ask InspectABike to send updates to <webhook URL>" otherwise.
   - This lets the user confirm after any reconnect that the secret actually arrived.

3. **If the user prefers disconnect + reconnect anyway**, it is safe:
   - Existing inspections and faults are untouched.
   - After reconnecting, check the new "Live updates" line on the card — if it shows a secret was stored, done; if not, fall back to step 1.

4. **Verify.**
   - Ask InspectABike (or trigger a test via their dashboard) to send an update, and confirm a fault change appears on a bike and the Repairs page without pressing Refresh.
