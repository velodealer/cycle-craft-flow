## Reports page

Replace the placeholder at `src/pages/ReportsPage.tsx` with a real reports dashboard, plus extracted section components.

### Time-frame control (top of page)
- Preset buttons: **Last 7 days**, **Last 30 days**, **Last 90 days**, **YTD**, **Last 12 months**, **All time**, **Custom**.
- Custom opens a `<DateRangePicker>` (calendar from shadcn) — `from` + `to`.
- Selected range is passed as `{ from: Date, to: Date }` to every section.
- Default: Last 90 days.

### KPI strip
Four cards above the sections, all scoped to the selected range:
- Revenue (sum of `invoices.gross` paid in range)
- Bikes sold (count of bikes with `status='sold'` and `updated_at` in range)
- Gross margin £ and %
- Active stock value (£ at cost) — snapshot, not range-dependent (labelled accordingly)

### Sections

1. **Sales pipeline analysis**
   - Funnel/bar chart of bike counts by status, restricted to bikes created/updated in range: pending_intake → intake → cleaning → inspection → repair → ready → listed → sold.
   - Side table: status, count, total asking price, total cost, projected margin.

2. **Stock aging**
   - Two tabs: **Bikes** | **Parts**.
   - Bucket by age = today − `intake_date` (bikes) / `created_at` (parts in stock): 0–30, 31–60, 61–90, 91–180, 180+.
   - Stacked bar by bucket × status (bikes: in_stock/ready/listed; parts: in_stock).
   - Drill-down table below: rows of items in the selected bucket (click bar → filters table).
   - Aging ignores the global timeframe (it's always "as of now") — note this on the card. The timeframe still filters sold items to compute aging-at-sale below.

3. **Margin analysis & profitability**
   - Per bike sold in range:
     `revenue = invoices.gross (type='bike_sale')`,
     `cost = purchase_price + collection_cost + delivery_cost + Σ parts.cost_price (bike_id=bike) + Σ jobs.actual_cost`,
     `margin = revenue − cost`, `margin% = margin/revenue`.
   - Summary cards: avg margin £, avg margin %, total margin.
   - Scatter plot: cost (x) vs sale price (y), point colour = margin%.
   - Sortable table: bike, sold date, revenue, cost, margin £, margin %.

4. **Revenue tracking**
   - Monthly stacked area chart of `invoices.gross` paid (bucket by `paid_at`), split by `invoices.type` (bike_sale / service / parts).
   - Cumulative line overlay.
   - Granularity toggle: Day / Week / Month — defaults based on range length (≤31d=day, ≤120d=week, else=month).

5. **Inventory turnover rates**
   - Computed per category (bikes overall, plus parts by `parts.type`).
   - `turnover = units sold in range / average inventory in range` (average of start + end snapshot ÷ 2).
   - `days on hand = range days / turnover`.
   - Table with: category, sold qty, avg inventory, turnover, days on hand.

### Data fetching
- One `useReportsData(range)` hook in `src/hooks/useReportsData.ts` that fires the queries in parallel: `bikes`, `parts`, `invoices`, `jobs` (only the fields each section needs). Returns memoised slices to each section so we don't hit Supabase per section.
- All aggregation done in JS (data volumes are small for a dealership). No new RPCs.
- Limit each query to its needed window with `.gte('created_at', from)` where applicable; fetch full table for stock-aging snapshot.

### File layout
- `src/pages/ReportsPage.tsx` — page shell, timeframe state, layout grid.
- `src/components/reports/TimeframePicker.tsx` — presets + custom range popover.
- `src/components/reports/KpiStrip.tsx`
- `src/components/reports/SalesPipelineSection.tsx`
- `src/components/reports/StockAgingSection.tsx`
- `src/components/reports/MarginAnalysisSection.tsx`
- `src/components/reports/RevenueTrackingSection.tsx`
- `src/components/reports/InventoryTurnoverSection.tsx`
- `src/hooks/useReportsData.ts`
- `src/lib/reports.ts` — pure aggregation helpers + age-bucket utility.

### Tech notes
- Charts: `recharts` (already installed).
- Date math: `date-fns` (already installed).
- Use existing shadcn `Card`, `Tabs`, `Button`, `Popover`, `Calendar`, `Table` primitives — no new deps.
- Loading: skeletons per section; errors: toast + inline retry button.

### Out of scope
- CSV / PDF export — can add later if needed.
- Workshop performance & custom report builder (the user dropped these from the requested list).
- Role-based filtering — page already gated to admin/accountant via existing route auth; no changes here.
