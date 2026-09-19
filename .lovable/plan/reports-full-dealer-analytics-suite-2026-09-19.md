# Reports: full dealer analytics suite

Turn the Reports page into a proper dealer analytics desk — car-dealer style — with period comparison and deep breakdowns by brand, groupset, size, type, channel and time-in-stock.

## What you'll see

**Top bar**
- Period picker gains: Week, Month, Quarter, Financial year (UK, 6 Apr–5 Apr), YTD, rolling 12 months, custom.
- New "Compare to" control: previous period, same period last year, or off. Every headline number shows the delta (value, % change, up/down colouring).
- Filters that apply to the whole page: brand, bike type, size, condition, acquisition route (owned / consignment / investor), price band.

**1. Headline KPIs (each with comparison delta)**
Revenue, units sold, gross profit, average gross profit per unit, average selling price, average days to sell, stock units, stock value at cost, ageing stock (>90 days) count and value, sell-through rate, inventory turn, average cost of reconditioning per unit.

**2. Sales performance**
- Revenue and units over time (day/week/month/quarter), with the comparison period overlaid as a dashed line.
- Revenue split by type: bike sales, service, detailing, parts.
- Cumulative revenue vs comparison ("pace" chart).
- Best/worst months table.

**3. Profitability**
- Gross profit waterfall: sale price → purchase cost → collection/delivery → parts → labour → net margin.
- Margin distribution histogram (how many bikes land in each margin band) and a front-end/back-end split (bike margin vs workshop/parts margin).
- Profit by VAT scheme (margin scheme vs VAT qualifying).
- Cost-to-prepare analysis: average parts + labour spend per bike, and how prep spend correlates with margin.

**4. Brand and model analytics**
- Table per brand: units sold, avg buy price, avg sell price, avg margin, margin %, avg days to sell, units in stock, ageing units.
- Top/bottom performing brands by profit and by speed of sale.
- Drill into a brand to see model-level rows.

**5. Specification analytics**
- Groupset: average sale price, average margin, average days to sell, units sold and in stock.
- Frame size: demand curve — what sells fastest, what sits, average price by size.
- Bike type (road / gravel / MTB / e-bike etc.), frame material, electric vs non-electric, wheel size.
- Price band analysis: which bands turn fastest and earn most.

**6. Stock and ageing**
- Current stock by age bucket (0–30 / 31–60 / 61–90 / 91–180 / 180+) with value at cost and at asking price.
- Ageing watchlist: oldest stock with days held, money tied up, and asking price vs what similar bikes actually sold for.
- Stock by pipeline stage, by storage bay/zone, and stock value trend over the period.
- Days-to-sell distribution and average by brand/size/type.

**7. Pipeline and operations**
- Funnel: intake → cleaning → inspection → repair → ready → listed → sold, with conversion rate and average time in each stage.
- Bottleneck view: where bikes wait longest.
- Workshop: jobs completed, average job cost, estimated vs actual cost variance, technician throughput.
- Inspections: faults per bike, approved vs declined, average rectification cost, share of bikes passing clean.

**8. Acquisition and channel**
- Where stock comes from (owned purchase, consignment, investor, part exchange) with volume, margin and days-to-sell per route.
- Listing channel presence (eBay, Shopify) and sold-vs-listed counts.
- Intake vs sales balance over time (are you buying faster than you sell?).

**9. Cash and invoicing**
- Invoiced vs paid, outstanding/overdue ageing, average days to payment.
- Deposits/part-exchange values, delivery charges recovered vs delivery cost paid.

**10. Export**
Every table gets a CSV export; the page gets a "print/PDF" friendly layout.

## Data honesty note

I checked the live data before writing this: of 83 bikes only 1 is marked sold, no bike has a `sale_price`, `sold_at` is empty on every record, and there are no paid invoices yet. So most of these charts will render as empty states until real sales flow through. To make them work as soon as sales happen, the calculations will fall back sensibly (`sold_at` → invoice paid date → bike updated date; invoice gross → bike sale price) and each panel shows a clear "no data for this period yet" state rather than a broken chart.

## Technical notes

- `src/lib/reports.ts`: add fiscal/quarter/week period builders, `comparisonRange()`, delta helpers, groupBy/aggregation utilities, CSV export, and a spec accessor for `spec_values.drivetrain.groupset` plus size normalisation reused from the bikes list filter.
- `src/hooks/useReportsData.ts`: widen the select (size, colour, bike_type, frame_material, is_electric, spec_values, source, acquired_via, finance_scheme, sold_at, storage_bay_id, asking_price, investor_id) and add fulfilment_events, inspections, inspection_faults, storage_bays, ebay/shopify listings. Fetch once for the union of current + comparison range; all slicing stays client-side and memoised, as today. Raise the row limit above the 1000 default where needed.
- New components under `src/components/reports/`: `ComparisonPicker`, `ReportFilters`, `SalesPerformanceSection`, `ProfitabilitySection`, `BrandAnalyticsSection`, `SpecAnalyticsSection`, `StockAgingSection` (extended), `PipelineFunnelSection`, `WorkshopSection`, `AcquisitionSection`, `CashflowSection`, plus shared `MetricCard` (with delta) and `DataTable` (sortable + CSV).
- Reports page reorganised into tabbed groups (Overview / Sales & Margin / Stock & Ageing / Brands & Spec / Operations / Cash) so it stays usable on a laptop and on mobile.
- Charts stay on recharts with existing theme tokens; no hardcoded colours. No database changes required.
