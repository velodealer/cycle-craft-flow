# Cycle Courier: use the dealer's own saved address

## What changes for you

Today every booking sends a fixed Brighton Premium Storage address as the other side of the job — the drop-off for collections, the pick-up for deliveries. That is wrong for any dealer other than BPS.

Cycle Courier already holds each dealer's own address against their account. So a booking will now only carry the customer's details and a flag saying which side of the job is the dealer; Cycle Courier fills in the dealer's name, phone and address itself.

- Collecting a bike: we send the seller's details, and mark the dealer as the delivery side.
- Delivering a sold bike: we send the buyer's details, and mark the dealer as the collection side.
- The Brighton Premium Storage name, email, phone and address fields disappear from the Cycle Courier settings card — nothing to fill in any more.
- If a dealer has no address saved on their Cycle Courier account, the booking is refused. We'll show a clear message telling them to add their address in their Cycle Courier profile, instead of a raw error.

## Connection

Every Cycle Courier call already runs through the connected account — bookings, order refresh and cancellation all use it, and the revoked key isn't used anywhere in the code. I'll also remove the leftover unused key field from the integration record so it can't creep back in.

## Technical detail

Per `docs/API_DOCUMENTATION.md`, sending `customer_side` on Create Order makes Cycle Courier populate that side's name, phone and address from the address saved against our app in the dealer's profile (falling back to their profile address); fields we send for that side are ignored, and that side's details are no longer required. A dealer with no usable address gets a 400 `CUSTOMER_ADDRESS_MISSING`.

- `supabase/functions/create-collection-order/index.ts`: drop the `integrations.settings.bps_receiver` lookup and its hardcoded fallback; payload keeps the seller as `sender` and adds `customer_side: 'receiver'`, with the `receiver` block removed. Collection record and bike-status handling unchanged.
- `supabase/functions/create-delivery-order/index.ts`: drop the `bps_receiver` sender block and BPS defaults; payload keeps the buyer as `receiver` and adds `customer_side: 'sender'`. The local `bike_collections` row stores the buyer side as now, with the shop-side address columns left blank.
- Both functions: map a 400 `CUSTOMER_ADDRESS_MISSING` response to a plain-English error ("Add your shop address to your Cycle Courier account before booking") stored on the record and returned to the UI.
- Where the courier echoes the filled-in dealer side back on the created order, write it onto the `bike_collections` row so logistics still shows both ends of the job.
- `src/components/settings/CycleCourierIntegration.tsx`: remove the delivery-address form, its state and save validation; keep connect/disconnect, status, and the super-admin-only webhook fields.
- `src/services/integrations.ts`: remove `BpsReceiverSettings` and the `bps_receiver` save path; drop the unused `api_key` field from the `Integration` type.
- Existing `bps_receiver` values stay in the settings JSON, unread; no migration needed.
- Redeploy both order functions; verify the build and a booking payload against the documented schema.
