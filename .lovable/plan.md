## Quote Builder — VAT display & scheme toggle

### Goal
Show VAT on each component line and on the totals, with a scheme toggle:
- **Standard (20%)**: each line's unit cost is treated as net; VAT = line net × 20%. Total VAT = sum of line VAT. Sale price is treated as gross (VAT-inclusive).
- **Margin scheme**: VAT = 0 on every line. Final VAT = (sale price − total cost) × 1/6, only if positive. Sale price is gross.

Assumptions (flag if wrong):
- Unit costs entered on lines are **net** amounts under standard scheme.
- Sale price stays a **gross** figure the customer pays; profit metrics keep using `sale − cost` as today (i.e. the margin/markup/ROI numbers don't change definition — VAT is shown alongside, not folded into profit).
- Child (credit) rows follow the same scheme as their parent (standard: −20% VAT credit; margin: £0 VAT).
- Scheme is per-quote, persisted with the quote, and captured in each version snapshot.

### Data model (`src/lib/quotes.ts`)
Add a `vat_scheme` field:

```ts
export type VatScheme = "standard" | "margin";

export type Quote = {
  // ...existing
  vat_scheme: VatScheme;
};
```

- Persist `vat_scheme` on `quotes` and `quote_versions`. Column is `text` with default `'standard'`; existing rows backfill to `'standard'`. Requires a small migration adding the column to both tables.
- `saveQuote` / restore paths thread the value through.
- Add helpers:
  - `lineVat(row, scheme)` → 20% of `qty × unitCost` for standard (negative for child rows), else 0.
  - `computeVat(rows, salePrice, scheme)` → returns `{ lineVatTotal, marginVat, totalVat }` where `marginVat = scheme === "margin" ? max(0, (sale − cost) × 1/6) : 0`.

### UI (`src/pages/QuoteBuilderPage.tsx`)
1. **Scheme selector** in the "Details" card: segmented control / Select with "Standard VAT (20%)" and "Margin scheme (VAT on profit)". Marks dirty on change.
2. **Components table**: add a "VAT" column between "Unit cost" and "Total". Renders `£0.00` (muted) under margin, or 20% of the line under standard; child rows show `− £X` in destructive tone. Mobile layout gets a matching row label.
3. **Totals block** below "Add component":
   - Total (net) cost
   - VAT on parts (standard only; £0 for margin)
   - Total (gross) cost
4. **Results card** (Sale price / Results): add a compact VAT summary line:
   - Standard: "VAT already included in cost lines: £X"
   - Margin: "VAT due on margin (1/6 of profit): £Y" — shows £0 when profit ≤ 0.
   No change to Profit / Margin / Markup / ROI formulas.

### History
`QuoteHistoryPanel` restore path passes `vat_scheme` through so restoring an old version also restores its scheme.

### Files to change
- `supabase` migration: add `vat_scheme text not null default 'standard'` to `quotes` and `quote_versions`.
- `src/lib/quotes.ts` — type, save/load, VAT helpers.
- `src/pages/QuoteBuilderPage.tsx` — scheme selector, per-line VAT column, totals, results VAT line.
- `src/components/quotes/QuoteHistoryPanel.tsx` — include scheme in restore payload.
- `src/pages/QuoteListPage.tsx` — (optional) small badge showing scheme; skip if not wanted.
