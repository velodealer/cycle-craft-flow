## Add Stand-In Value (SIV) to the cost & profit breakdown

Add an SIV row + small explainer block at the bottom of the breakdown on:
- `src/components/bike/BikeDetailView.tsx` (admin Pricing & Finance card)
- `src/pages/investor/InvestorBikePage.tsx` (investor breakdown card)

### Formula

Let `acquisition` = purchase price, `prep` = collection + delivery + parts + jobs, `totalCost` = acquisition + prep.

- **Margin scheme** (`finance_scheme === 'margin_scheme'`):
  `SIV = acquisition + prep / (1 − 1/6) = acquisition + prep × 1.2`
  At this price, margin VAT = `(SIV − acquisition) × 20/120` exactly equals `prep × 0.2`, so net retained = totalCost (break-even).
- **VAT qualifying** (`vat_qualifying`):
  `SIV = totalCost × 1.2` (output VAT added on top of full cost).
- **Commercial / other**:
  `SIV = totalCost`.

### UI
A highlighted row beneath "Net profit" / above investor share:
- Label: **Stand-In Value (break-even price)**
- Value: formatted SIV
- Sub: short explanation ("Lowest sale price that covers all costs and VAT liabilities under the {scheme} scheme.")
- If `revenue > 0`, also show **Headroom vs SIV** = `revenue − SIV` (red if negative, green-ish/default if positive).

### Out of scope
- No DB or form changes — SIV is purely derived.
- No changes to dashboard table (kept compact); SIV only on detail views.
