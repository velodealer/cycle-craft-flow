## Goal
Add a **New Bike Builder Quote** page where a user lists components with costs, sees a running total, then enters a sale price to see profit, margin, markup and ROI.

## Scope
A self-contained calculator page — no database persistence for now (matches "quote" framing: quick what-if tool). Can be extended later to save quotes if needed.

## UX
Route: `/quote-builder` (linked from the sidebar under a suitable group, e.g. Bikes or Reports).

Layout:
1. **Header** — title + short description.
2. **Components table** — repeater rows, each with:
   - Description (text)
   - Category (optional dropdown: Frame, Wheels, Groupset, Bars, Stem, Saddle, Tyres, Other)
   - Quantity (number, default 1)
   - Unit cost (£)
   - Line total (read-only)
   - Remove button
   - "Add component" button below the table
3. **Totals card** — Total component cost.
4. **Sale price input** — single £ field.
5. **Results card** — Profit (`sale − cost`), Margin (`profit / sale`), Markup (`profit / cost`), ROI (`profit / cost`), each formatted, colour-coded (green positive, red negative).
6. **Reset button** to clear everything.

State kept in React (useState). No Supabase calls.

## Files
- `src/pages/QuoteBuilderPage.tsx` — new page with everything above.
- `src/App.tsx` — add `/quote-builder` route inside `guarded(<Layout>…)`.
- `src/components/AppSidebar.tsx` — add nav entry (hidden for investors, consistent with existing gating).

## Non-goals
- No saving to DB, no linking to a bike record, no VAT scheme handling. Pure calculator.
- No PDF/export — can be added later if requested.
