# Fix operational screens, workflows, and settings

## 1. Remove horizontal scrolling and repair crowded layouts

- Rebuild the bike record header so the title has its own stable area and the action buttons wrap into a responsive toolbar instead of compressing the bike name or leaving the viewport.
- Make the stage tracker and record sections fit the available width at tablet, laptop, and mobile sizes.
- Replace wide desktop tables on Bikes, Cleaning, Inspection, and Logistics with responsive, width-aware rows: preserve the important information, combine secondary fields, and hide only low-priority fields at narrower widths. Mobile keeps the existing card treatment.
- Reflow the Intake location controls and Process intake button so each row remains within the panel at every width.
- Verify the affected pages at mobile, the current 895px preview width, and desktop without horizontal page or panel scrolling.

## 2. Bikes pagination

- Add pagination after filtering, with 25 bikes per page, previous/next controls, page count, and a visible result range.
- Reset to page 1 when search or filters change.
- Keep label selection limited to the filtered/currently displayed set so counts and bulk actions remain clear.

## 3. InspectABike inspection queue and automatic progression

- Keep the Inspection page as a clear list of bikes awaiting inspection, without opening the full bike record in a modal.
- Make Start inspection create or reuse the bike’s InspectABike inspection, then open the inspection URL returned by InspectABike for that bike.
- Handle completion webhooks, including inspections completed with no faults:
  - one or more reported faults → Awaiting owner approval;
  - no faults → Ready for sale.
- Refresh the queue when the user returns to VeloDealer so completed bikes disappear automatically.
- Preserve idempotency, dealership-specific OAuth credentials, and webhook signature verification.

## 4. Logistics visibility, live status, and Cycle Courier links

- Condense each logistics row so bike, direction/status, route, schedule, tracking, and actions are immediately visible without horizontal scrolling.
- Add a live Refresh action that retrieves the current Cycle Courier order and reconciles the local status, timestamps, and tracking details.
- Use that reconciliation to correct `BPS-GIA-9691`; its current local row is confirmed as `cancelled`, while the reported Cycle Courier state must be fetched before changing it.
- Replace the current action, which only attempts to open a bike query URL, with actions that open the bike record and the actual Cycle Courier order/tracking page.
- Centralise courier status labels so delivered/in-transit/cancelled states display consistently.

## 5. Parts inventory location

- Add a nullable storage-bay link to parts, using the existing dealership-scoped bays and retaining existing parts as unassigned.
- Add the bay selector to add/edit part forms and show/filter location in the parts inventory.
- Keep the existing tenant access rules; no new public access is introduced.

## 6. Remove obsolete pages and settings

- Remove Owners from navigation and routing. Keep underlying customer/consignor records used by sales and invoices; staff remain managed in Settings → User Management.
- Remove the placeholder System Configuration section while retaining the working bike-reference and delivery settings.
- Remove InspectABike Backfill and the duplicate More Integrations panel from the Integrations tab.

## 7. Dealership-scoped email notifications

- Pass the originating `business_id` through every notification path.
- Load that dealership’s Resend settings and restrict “All admins and owners” to profiles with the same `business_id`.
- Apply the same scoping to test emails and prevent one dealership from reading or updating another dealership’s notification configuration.

## 8. Listing format isolation and storage-bay summary

- Render HTML listing previews inside a sandboxed iframe so template `<style>`, `<meta>`, and page-level markup cannot alter the Settings heading or surrounding application.
- Escape substituted bike fields before inserting them into HTML previews while preserving the dealer-authored template markup.
- Replace the 120 individual storage-bay editor cards with grouped bay runs. The current data is six ranges, A1–A20 through F1–F20, so Settings will show one row per letter with its numeric range and status, while still allowing individual bays to be managed when a group is expanded.

## Validation

- Apply the parts schema migration and regenerate client types through the connected database workflow.
- Test InspectABike create/open/completion behavior and Cycle Courier refresh/link handling.
- Confirm dealership email isolation with two-business queries/tests.
- Run the project checks and visually verify all affected widths and flows.
