## Collection cost, delivery cost, and VAT margin display

### 1. Database (migration)
Add two columns to `public.bikes`:
- `collection_cost numeric` (nullable)
- `delivery_cost numeric` (nullable)

No RLS changes — existing bike policies cover them.

### 2. Bike form (`src/components/management/BikeForm.tsx`)
In the Pricing & Finance card (already hidden for mechanics), add two new currency inputs alongside purchase/asking/sale price:
- "Collection cost"
- "Delivery cost"

Include them in the insert/update payload.

### 3. Bike detail view (`src/components/bike/BikeDetailView.tsx`)
In the Pricing & Finance card:
- Show **Collection cost** and **Delivery cost** in the existing details row.
- Update the Profit/Margin/Markup/ROI computation so total cost = `purchase_price + (collection_cost ?? 0) + (delivery_cost ?? 0)` and profit subtracts these too.
- Add a **VAT (margin scheme)** line that displays only when `finance_scheme === 'margin_scheme'`:
  - `gross_margin = revenue - total_cost` (revenue = sale_price ?? asking_price)
  - `vat_on_margin = max(0, gross_margin) * 20 / 120` (UK VAT margin scheme: VAT = 1/6 of gross margin)
  - Show formatted currency, with subtitle "20% VAT on margin". When scheme is `vat_qualifying` or `commercial_vat`, hide this line (those are calculated differently and out of scope unless requested).

### Out of scope
- No changes to invoices/jobs/parts costing.
- No backfill of historical bikes (new columns default null, treated as 0 in math).
