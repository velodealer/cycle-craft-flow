# Fix Cycle Courier "delivered" not showing in VeloDealer

## What was found
- CCC754507545377MICB13 is linked to **BPS-RIB-RACE** (Ribble Endurance SL R Disc), an inbound collection. VeloDealer still shows the booking as "created" and the bike as "Awaiting collection". The last update was 1 Oct.
- VeloDealer has no record of Cycle Courier ever sending an update. The courier update receiver has no logs at all, so Cycle Courier's own status messages aren't reaching us.
- The Refresh check has also never been run for this booking.
- **FB21055635** isn't saved on any booking or bike in VeloDealer.

## Plan
1. **Fix this bike now:** pull the latest status for this booking from Cycle Courier, using the same check as the Refresh button. Then mark the booking Delivered and move BPS-RIB-RACE to Intake, and record the change in the bike's history.
2. **Automatic catch-up:** every 30 minutes, check Cycle Courier for every open booking and apply any changes, like delivered, collected or cancelled. Statuses then stay correct even when Cycle Courier's updates never reach us.
3. **Refresh all button** on the Logistics page, so you can force a check straight away.
4. **Find out why updates aren't arriving:** check that our update address and signing key are registered on the dealership's Cycle Courier account, and show the result in Settings → Integrations.
5. **FB21055635:** if this is another Cycle Courier order, link it to its bike with "Link existing booking". Step 1 will then sync it too.

## Technical details
- New edge function `cycle-courier-poll` (cron via pg_cron + pg_net, every 30 min). For each business, it runs through bike_collections where status is not in (delivered, cancelled) and order_id is not null. It reuses the cycle-courier-order-sync logic, moved into `_shared/cycle-courier-sync.ts`, which covers shouldApplyStatus, the bike status mapping (inbound delivered → intake, outbound → delivered; collected → in_transit/pending_intake) and logBikeActivity.
- order-sync gains `{ all: true }` for the Refresh all button, scoped to the caller's business.
- Webhook diagnostics: log every request, including rejected ones, to integration_error_log.
