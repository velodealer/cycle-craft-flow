# Clean operational lists, bays, courier tracking, and Settings

## Bikes

- Rebuild the filter area as a deliberate responsive grid: search gets the wider first position, while status, source, location, and size stay aligned in equal controls.
- Give the desktop bike rows more breathing room by simplifying the information hierarchy and allocating stable widths to bike, stage, bay, and price content.
- Make the bike photo and title open the bike record. Remove the separate eye action from desktop and mobile.
- Keep the existing 25-bike pagination and mobile card layout.

## Bay assignment everywhere

- Update the shared bay control used by Bikes, Cleaning, and Inspection.
- When no bay is assigned, show the letter and number fields with **Assign**.
- When a bay is assigned, show its name as plain text with a smaller **Change bay** button underneath.
- Clicking **Change bay** reveals the inputs prefilled with the current bay, with clear save/cancel behavior.
- Keep assignment restricted to bays already created in Settings.

## Cleaning and Inspection

- Rebalance desktop rows so the bike identity, frame, bay, and primary action fit cleanly without overlap.
- At narrower desktop/tablet widths, switch to a roomier stacked row treatment before content becomes compressed.
- Keep Cleaning’s **View & Clean** action and Inspection’s **Start inspection** action clearly separated from bay controls.
- Make bike photos and titles clickable where they open a full bike record; Cleaning’s dedicated cleaning action remains available separately.

## Cycle Courier tracking and bike reference

- Send the readable VeloDealer bike reference, such as `BPS-GIA-9691`, as `customerOrderNumber` for both collection and delivery bookings instead of the internal UUID.
- Keep the UUID only for secure internal database relationships.
- Normalize Cycle Courier booking, refresh, and webhook responses so tracking is captured from supported camelCase, snake_case, and nested order fields.
- Persist tracking whenever it arrives or changes, and show the order number as a fallback identifier until a tracking number is issued.
- Ensure manual refresh updates tracking and status together without hiding a row when its status changes tabs.

## Settings

- Restore the working System content: Bike Reference settings and Delivery settings.
- Remove only the obsolete “coming soon” System Configuration/Security placeholder content.
- Preserve the existing tabs and role visibility, including super-admin-only Inbox, Website, and Super Admin tabs.

## Technical details

- Main UI files: `BikeList.tsx`, `LocationSelect.tsx`, `CleaningPage.tsx`, `InspectionPage.tsx`, and `SettingsPage.tsx`.
- Courier updates cover collection booking, delivery booking, order refresh, and webhook synchronization so tracking behavior is consistent across every path.
- No database schema change is expected.

## Validation

- Check Bikes, Cleaning, and Inspection at mobile, the current 895px viewport, and wide desktop with no overlap or horizontal scrolling.
- Verify title/photo navigation and confirm no eye action remains on Bikes.
- Test unassigned, assigned, change, cancel, and reassignment bay states.
- Verify a courier request sends the readable bike reference and that returned/refreshed tracking appears in Logistics.
- Run project checks and confirm the current preview builds without errors.
