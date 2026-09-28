# Quote builder: prices entered include VAT

Today, under Standard VAT, the builder treats each price you type as before VAT and adds 20% on top. Prices you type will now be treated as already including VAT.

## What changes
- **Unit cost** and **Line total** show the price you typed, including VAT (no change to what you enter).
- **VAT column** on each line shows the VAT already inside that price (1/6 of the line total), not 20% added on top.
- Totals box:
  - **Gross cost** = the sum of the line totals as typed (including VAT).
  - **VAT on parts** = the VAT contained in those totals.
  - **Net cost** = gross minus VAT (the total without VAT).
- Helper text under the VAT scheme picker changes to "Prices include 20% VAT; VAT is shown per line."
- The Results card's "VAT on parts (20%)" and "Total VAT" use the same included-VAT figure.
- Profit, margin, markup and ROI still use the full cost you typed, so they don't change.
- Margin scheme and non-VAT-registered dealerships work the same as today.
- Saved quotes: prices stay as saved and are now read as including VAT, so their Net cost and VAT figures will come out lower than before.

## Technical notes
- `src/lib/quotes.ts`: `lineVat` for standard becomes `lineNet(r) / 6` (child rows stay negative). `computeVat` otherwise unchanged; add `netCost = totalCost - lineVatTotal` to its return value.
- `src/pages/QuoteBuilderPage.tsx`: totals box shows Net cost = `vat.netCost`, Gross cost = `totalCost`; update the helper text. No change to storage or the database.
