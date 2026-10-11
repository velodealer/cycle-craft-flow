# Receive Cycle Courier updates for sign-in (OAuth) connections

## Cause (confirmed by Cycle Courier's own findings)
Cycle Courier only sent updates to the old "VDMS - BROXIMO" webhook, and that has been switched off since 19 Sep. Connecting through sign-in did not sign VeloDealer up for updates. They are now adding a single webhook address for the VeloDealer partner app and need ours. When the old webhook was on, our side often replied "Collection not found". Our receiver has two problems:
- It looks for one shared integration row to get the signing secret. With multiple dealerships, that lookup fails or picks the wrong row.
- It matches orders only on the order ID field in their message. A tracking number or a different ID shape isn't matched.

## What changes
1. **Give Cycle Courier one partner address:** `https://api.velodealer.com/functions/v1/cycle-courier-webhook`. Every dealership uses this same address.
2. **One signing secret for the partner app.** Cycle Courier generates it on their Partner Apps page and shows it once. You paste it into a secure form here, and we check every update against it. We fall back to the old per-dealership secret only for legacy webhooks.
3. **Better order matching:** we match on order ID, then on tracking number, in that order. If nothing matches, the reply says what we searched for, and the attempt is logged so it can be traced.
4. **Their catch-up resend works:** once they resend the current statuses, CCC754507545377MICB13 updates to Delivered on its own, and BPS-RIB-RACE moves to Intake.
5. **Backup refresh:** a Refresh all button on Logistics, plus an automatic check every 30 minutes for open bookings. Statuses then stay correct even if updates are missed again.
6. **FB21055635** isn't on any booking here. Link it with "Link existing booking" if it belongs to a bike.

## What you'll do
- Send Cycle Courier the address above.
- When they show the signing secret, paste it into the secure form I'll open.

## Technical details
- Secret `CYCLE_COURIER_PARTNER_WEBHOOK_SECRET`, added via add_secret. HMAC-SHA256 of the raw body, `sha256=` prefix optional, constant-time compare. Legacy fallback: integrations rows where name is cycle_courier_co, trying each active secret.
- Lookup: `order_id = data.id`, else `tracking_number = data.trackingNumber`/extractTrackingNumber, using maybeSingle() and the most recent match. The business comes from the matched row.
- Log failures to integration_error_log.
- New `cycle-courier-poll`, run by pg_cron every 30 minutes, with the sync logic moved into `_shared/cycle-courier-sync.ts`. order-sync gains `{ all: true }`, which the Logistics Refresh all button uses.
