# Repairs approval page

A new page that lists every bike with inspection faults waiting on a decision, showing the repairs underneath each bike so an admin or owner can approve or decline them in one place.

## What you'll see

- New "Repairs" item in the left menu (admin and owner only), at `/repairs`.
- One card per bike: photo, reference, make/model/size/colour, current status, storage bay, and a count of repairs awaiting approval.
- Underneath each bike, the list of repairs: title, component, description, parts cost, labour cost, line total, and status badge.
- Approve / Decline buttons on each repair (with an optional note), same behaviour as on the bike page — the decision is sent to InspectABike first, then reflected here.
- Per-bike totals: awaiting approval total and already-approved work total.
- A "View costing" button on each bike opens a popup with the full cost and profit breakdown (asking/sale price, acquisition, collection, delivery, parts, labour, total costs, gross/net profit, VAT where applicable, Stand-In Value and headroom).
- Filter tabs: Awaiting approval (default) / All open / All, plus a text filter by bike reference or name.
- Clicking the bike title opens that bike's page.

## Technical notes

- New `src/pages/RepairsPage.tsx`, route `/repairs` in `src/App.tsx` wrapped in `Layout` + `InvestorGuard`; nav entry in `src/components/AppSidebar.tsx` restricted to `admin`, `owner`.
- Data: one query on `inspection_faults` filtered by status, then a second query on `bikes` for the distinct `bike_id`s (id, reference, make, model, year, size, colour, status, photos, storage_bay_id, prices/costs, finance_scheme, source, profit_share_pct). Group faults by bike in memory.
- Decisions reuse the existing `inspectabike-decision` edge function call exactly as `InspectionFaults.tsx` does; refresh the affected bike's faults after a decision. No backend or database changes.
- Cost popup: extract the existing cost/profit breakdown block from `src/components/bike/BikeDetailView.tsx` into `src/components/bike/BikeCostBreakdown.tsx` (props: bike, partsCost, jobsCost, strippedInventoryValue) and render it both in `BikeDetailView` and inside a `Dialog` on the new page, so the numbers stay identical everywhere. Parts and jobs totals for the popup are fetched on demand for that bike.
- Mobile-first layout: stacked cards, no horizontal scrolling, reusing `BikeThumbnail` and existing card/badge/dialog components.
