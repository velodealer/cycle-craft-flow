## What's going on

### 1. Boardman "Stand-In Value ≈ £100" after stripping

The Boardman TTE 9.8 (`21f1808c…`) was purchased for £500 and stripped into 4 inventory rows (Frame £50, Cockpit £50, Drivetrain £200, Wheelset £200 = £500). For each kept group `BreakBikeDialog` writes a matching **negative credit** row on the bike (`bike_id = bike.id`, `cost_price = -value`) so accounting nets out.

In `BikeDetailView.refreshCosts` we sum **all** `parts` rows where `bike_id = bike.id` — credits included — so `partsCost = -£500`. The Cost & profit panel then computes:

- `totalCost = 500 + 0 + 0 + (-500) + 0 = £0`
- `SIV (margin scheme) = acquisition + prep·1.2 = 500 + (-500·1.2) = -£100`

That's the "£100" you're seeing. The whole "Stand-In Value" block is also conceptually meaningless once a bike has been split — there's nothing left to sell as a bike. The right fix is to **hide the Cost & profit / SIV block when `bike.status === 'split_for_parts'`** and replace it with a short "Stripped for parts" summary showing acquisition cost vs total value moved into inventory (sum of positive in-stock rows where `stripped_from_bike_id = bike.id`) and the residual difference.

### 2. VAT margin should always be `(sale/asking price − acquisition) × 20/120`

Current formula uses `gross = revenue − totalCost` as the VAT base, so prep/labour/parts shrink the VAT figure. You want VAT to ignore every cost except acquisition.

## Changes

### `src/components/bike/BikeDetailView.tsx`
- In the Pricing & Finance breakdown:
  - Change VAT base: `const vatBase = revenue - acquisition;` and `const vat = isMargin ? Math.max(0, vatBase) * 20 / 120 : 0;` (net profit still = `gross - vat`, so all other costs continue to reduce real profit).
  - Remove the `sub="20% VAT on gross margin paid to HMRC"` helper text on the VAT row — show just label + amount.
  - Remove the `sivExplain` paragraph under "Stand-In Value" (keep the label + figure only).
- When `bike.status === 'split_for_parts'`:
  - Skip the entire Cost & profit / SIV / Margin·Markup·ROI block.
  - Render a compact "Stripped for parts" card instead:
    - Acquisition cost
    - Value moved to inventory (sum of `parts.cost_price * quantity` where `stripped_from_bike_id = bike.id` AND `cost_price > 0`)
    - Residual (acquisition − inventory value), red if positive (unrecovered cost)
  - Fetch the inventory-side total alongside `refreshCosts` (`parts` filtered by `stripped_from_bike_id`).

### `src/pages/investor/InvestorBikePage.tsx`
- Same VAT base change: `vatOnMargin = isMargin ? Math.max(0, revenue - acquisition) * 20 / 120 : 0`.
- Remove the `sub="20% VAT on gross margin paid to HMRC"` text on the VAT row.
- Remove the "After {fmt(vatOnMargin)} VAT" caption under Net profit.
- Remove the `sivExplain` sentence under Stand-In Value.

### `src/pages/investor/InvestorDashboardPage.tsx`
- Same VAT base change for the per-bike calc that feeds the table/summary.
- Remove the paragraph: *"All costs (acquisition, collection, delivery, parts, labour) and margin-scheme VAT are deducted before your share is calculated."* (and any other inline VAT-scheme explainers in this file).

## Out of scope
- No change to `BreakBikeDialog` — credit rows stay so the bike's P&L still nets out for non-split states.
- No schema migration.
- No change to the VAT scheme selector / labels on the bike form.
