# Finish InspectABike live updates

## What the check found
- Reconnected at 14:40 today. The connection is active and has a fresh access token.
- InspectABike did not send back a signing key when you reconnected. No dealer-specific key is saved.
- This is expected: you chose "one shared address per dealer software", so one VeloDealer-wide key is used instead.
- That shared key slot already exists, but it may still hold the old value.
- No live updates from InspectABike have reached VeloDealer yet.

## Steps
1. Open the secure form so you can paste the signing secret InspectABike gave VeloDealer. It replaces the shared key, so there's nothing to disconnect.
2. Ask InspectABike to send a test update, or make a small change on a test inspection.
3. Check the live-update log to confirm it arrived, was signed correctly and was matched to your dealership. If it was rejected, report the exact reason (wrong key or unknown account).
4. Once updates are confirmed, press Refresh on BPS-GIA-5137 and re-check its faults.

## Technical
- Update the shared webhook secret in the secure store (no code change).
- Check the inspectabike-webhook logs for signature pass/fail and business matching.
