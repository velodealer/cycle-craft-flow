# After-sale status: Delivered or Collected

The statuses "Collected" and "Delivered" already exist, but they only show up as early steps before intake (for inbound courier pickups). Once a bike is sold, nothing comes after "Sold". This plan adds a proper finishing step after the sale.

## What changes

1. **New final stage after Sold**
   - Sold bikes show one more step after "Sold" on the bike's stage bar. It reads "Collected" if the sale was customer collection and "Delivered" if it was a delivery.
   - Before handover it shows as the next step. Once it's done, it shows as complete.

2. **Mark handed over button on sold bikes**
   - On a sold bike's page: **Mark as collected** (customer collection) or **Mark as delivered** (delivery). The button that shows depends on the delivery method picked when the sale was recorded.
   - The existing deferred-job rule still applies. If deferred jobs are open, an owner or admin must give a reason, and it is logged in the bike's history.

3. **Automatic for courier deliveries**
   - When Cycle Courier Co reports an outbound delivery as done, the sold bike becomes "Delivered", as it does now.
   - When the courier picks a sold bike up from the shop, it shows "In transit" instead of "Collected". That way "Collected" always means the customer took the bike.

4. **Lists and filters**
   - Bikes page filters already include Delivered. "Collected" will be added too.
   - Both count as sold in reports and dashboard totals, so sales figures stay the same.

## Technical details

- No database change: the `collected` and `delivered` bike_status values already exist.
- `StatusProgressBar.tsx`: when the status is sold, collected or delivered and the bike was not an inbound collection, add a handover stage after Sold. The label comes from `bikes.delivery_method`. Inbound collection stages stay as they are.
- `BikeDetailView.tsx`: add a handover button for sold bikes. It reuses the deferred-job check and override reason from `AdminStatusSelect` and logs to bike_activity.
- `cycle-courier-webhook`: an outbound pickup maps to `in_transit`. An outbound drop-off still maps to `delivered`.
- Check the report and dashboard sold filters (`reportMetrics`, `useDashboardCounts`) so they include collected and delivered.
- `BikeList.tsx`: add a "Collected" status filter.
