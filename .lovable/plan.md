# Cycle Courier: drop the Brighton Premium Storage address

## What changes for you

Today every booking sends a fixed Brighton Premium Storage address as the other side of the job — as the drop-off for collections and as the pick-up for deliveries. That is wrong for any other dealer.

Since each dealer's shop address already lives in their own Cycle Courier account, the booking will simply say who the customer is and which way the bike is going. Cycle Courier fills in the dealer's own address from the connected account.

- Collecting a bike: we send the seller's details and mark the job as a collection to the dealer.
- Delivering a bike: we send the buyer's details and mark the job as a delivery from the dealer.
- The Brighton Premium Storage name, email, phone and address fields disappear from the Cycle Courier settings card — nothing to fill in any more.

## Connection

All Cycle Courier calls already run through the connected account (bookings, order refresh, cancellations); the old key is not used anywhere in the code. As part of this work I'll re-confirm that end to end and remove the unused key field left on the integration record so it can't creep back in.

## Waiting on

You mentioned you'd attach the Cycle Courier documentation. I need it to use the exact field name for the direction and the single customer party (for example `jobType` / `direction`, and whether the customer goes in `sender`, `receiver`, or a single `customer` block). Once it's attached I'll match the payload exactly. Without it I'd be guessing field names and bookings would fail.

## Technical detail

- `supabase/functions/create-collection-order/index.ts`: remove the `integrations.settings.bps_receiver` lookup and the hardcoded fallback; payload carries the seller as the customer party plus the direction flag. Collection record and bike status handling unchanged.
- `supabase/functions/create-delivery-order/index.ts`: same — remove the `bps_receiver` sender block and its BPS defaults; payload carries the buyer plus the direction flag.
- `src/components/settings/CycleCourierIntegration.tsx`: remove the delivery-address form, its state and the save validation; keep connect/disconnect, status and the super-admin-only webhook fields.
- `src/services/integrations.ts`: remove `BpsReceiverSettings` and the `bps_receiver` save path; drop the unused `api_key` field from the integration type.
- Existing `bps_receiver` values stay in the settings JSON, unread; no migration needed.
- Redeploy both order functions and re-run a booking payload check against the documented schema.
