## Full-transparency cost breakdown on investor pages

### 1. Investor bike detail page (`src/pages/investor/InvestorBikePage.tsx`)
Replace the current minimal summary with a full cost breakdown card:

- **Revenue:** sale price (if sold) else asking price (labelled "Listed").
- **Acquisition cost:** purchase price (paid to original seller).
- **Collection cost** (inbound shipping).
- **Delivery cost** (outbound shipping).
- **Parts cost:** sum of `parts.cost_price * quantity` for this bike.
- **Labour / job cost:** sum of `jobs.actual_cost ?? estimated_cost` for this bike.
- **Total costs:** sum of the above.
- **Gross profit:** revenue − total costs.
- **VAT (margin scheme):** when `finance_scheme = 'margin_scheme'`, `max(0, gross_profit) * 20/120`. Shown as a deducted line.
- **Net profit (after VAT):** gross_profit − vat_on_margin.
- **Investor share %:** `profit_share_pct`.
- **Your return:** `max(0, net_profit) * profit_share_pct/100`.
- Footnote clarifying "realised" vs "estimated" based on sold/listed status.

### 2. Investor dashboard (`src/pages/investor/InvestorDashboardPage.tsx`)
Update the returns calculation to use the same formula (subtract collection/delivery/parts/jobs AND VAT-on-margin before applying profit_share_pct). Add a small "Costs to date" column already shown — expand it so it now includes collection + delivery in addition to parts + jobs. Totals (realised / unrealised) reflect the corrected, post-VAT net.

### 3. Apply same logic to admin Bike Detail's Investor card
In `src/components/bike/BikeDetailView.tsx`, the existing "Estimated investor return" line uses `(sale_price - purchase_cost) * share`. Update it to use the same net-after-all-costs-and-VAT formula so admin and investor views agree.

### Data fetching
- Already fetching bikes + jobs + parts on the dashboard. Add `collection_cost`, `delivery_cost` to the bike `select`.
- On the investor bike page, fetch jobs + parts for that single bike.

### Out of scope
- VAT for `vat_qualifying` / `commercial_vat` schemes (only margin scheme is deducted; for the others, VAT is recovered/passed through differently — leave net profit = gross profit).
- No DB changes.
