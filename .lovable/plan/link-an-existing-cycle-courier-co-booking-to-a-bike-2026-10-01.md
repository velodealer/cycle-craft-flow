# Link an existing Cycle Courier Co booking to a bike

For jobs booked directly in Cycle Courier Co (not through VeloDealer), you can paste the order link and the bike's Logistics row will then track it like any other booking.

## What changes
- A **Link existing booking** button on the Logistics page and in the bike's Collection/Delivery panel.
- The popup asks for:
  - the bike (picked by reference or name; already filled in when opened from a bike),
  - collection (coming in) or delivery (going out),
  - the Cycle Courier Co order link or order number.
- On save, VeloDealer looks the order up on your connected Cycle Courier account and:
  - checks it exists and belongs to your account (a clear message if not),
  - saves the tracking number, current status, addresses and contact details,
  - moves the bike to the matching stage (for example Delivered or Collected), as the refresh button already does.
- After that, Cycle Courier's own updates (webhook) and the refresh button keep the status and tracking number current, with no extra setup.
- One order can be linked to only one movement. Linking an order that is already in use shows which bike it is on.
- The link is recorded in the bike's history.

## Not included
- A tracking number on its own can only be used if Cycle Courier's account lets us search by it. If it can't, the popup asks for the order link instead.

## Technical notes
- New edge function `cycle-courier-link-order`: auth + profile business_id, parse the order id from `booking.cyclecourierco.com/orders/<id>`, a tracking page URL or a bare id; `cycleCourierFetch(GET /orders/<id>)` (404/403 mean "not found on your account"); insert into `bike_collections` (business_id, bike_id, direction, order_id, tracking_number via `extractTrackingNumber`, status via `extractCourierStatus`, sender/receiver fields via `extractParty`); bike status updated through the same mapping as `cycle-courier-order-sync`; `bike_activity` entry.
- Duplicate guard: check for an existing `bike_collections.order_id` within the business before insert (409 with the bike reference). A partial unique index on `(business_id, order_id)` is added only if the existing data has no duplicates; otherwise the code check is the only guard.
- The webhook already matches on `order_id`, so linked rows receive status/tracking updates unchanged.
- UI: new `LinkCourierOrderDialog.tsx`, used in `LogisticsPage.tsx` (header action) and `CollectionStatus.tsx` (shown when the bike has no movement in that direction).
