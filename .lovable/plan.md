## Add Profit, Margin, Markup, ROI to Pricing & Finance

In `src/components/bike/BikeDetailView.tsx`, extend the Pricing & Finance card with a metrics row below the existing prices.

**Basis** (uses sale price if sold/available, otherwise asking price):
- `revenue = bike.sale_price ?? bike.asking_price`
- `cost = bike.purchase_price`
- `profit = revenue - cost`
- `margin % = profit / revenue * 100` (revenue-based)
- `markup % = profit / cost * 100` (cost-based)
- `roi % = profit / cost * 100` (same formula as markup but labeled separately for clarity, computed on total invested cost = purchase price)

Render a 4-column grid (2 on mobile) showing Profit, Margin, Markup, ROI. Each value formatted via `formatCurrency` or `X.X%`. Show `-` when revenue or cost is missing. Label notes "Based on sale price" or "Based on asking price" depending on which was used.

**Out of scope:** Does not include parts/jobs costs in profit (matches existing investor card behavior). No DB changes.
