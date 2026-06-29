## Mirror the investor cost & profit breakdown on the admin Bike Detail

In `src/components/bike/BikeDetailView.tsx`, replace the current Pricing & Finance card's metrics section (Profit / Margin / Markup / ROI + VAT block + separate Investor card return) with the same itemized breakdown investors see on `InvestorBikePage.tsx`.

### Data
The view doesn't currently fetch jobs/parts. Add a `useEffect` inside `BikeDetailView` that, when `canSeePricing` is true and `bike.id` is set, fetches:
- `jobs` (bike_id, actual_cost, estimated_cost)
- `parts` (bike_id, cost_price, quantity)
Sum into `partsCost` and `jobsCost`.

### Card content (admin Pricing & Finance)
Keep the existing price/date/VAT-scheme rows at the top. Replace the metrics block below with:

- Revenue (Sale price if sold, else Asking price — labelled accordingly)
- − Acquisition cost (purchase_price; fallback purchase_cost)
- − Collection cost
- − Delivery cost
- − Parts
- − Labour / jobs
- **Total costs**
- **Gross profit** (red if negative)
- − VAT (margin scheme) — only when `finance_scheme === 'margin_scheme'`, computed `max(0, gross) * 20/120`, with subtitle "20% VAT on gross margin paid to HMRC"
- **Net profit** (red if negative)
- Margin / Markup / ROI — keep as a small footer row using net profit & total cost (margin = net/revenue, markup = roi = net/totalCost)
- Footnote: realised vs estimated

### Investor card update
The "Investor" card already shows investor share. Replace its `Estimated investor return` math with the shared net-after-VAT formula (already wired in last turn) and additionally show `Net profit` and `Your share %`. Keep Investor ID, profit share %, purchase cost rows.

### Out of scope
- No DB changes.
- No changes to the form.
- Doesn't apply to investor-side pages (already done).
