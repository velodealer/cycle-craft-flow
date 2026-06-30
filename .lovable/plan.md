Update SIV (Stand-In Value) to be total cost only, with no margin-scheme or VAT markup.

## Changes

### `src/components/bike/BikeDetailView.tsx`
- Replace the conditional SIV calculation:
  ```ts
  const siv = isMargin ? acquisition + prep * 1.2
            : isVatQualifying ? totalCost * 1.2
            : totalCost;
  ```
  with:
  ```ts
  const siv = totalCost;
  ```
- Remove the now-unused `isVatQualifying` variable if it is only used for SIV. Keep `isMargin` because it is still needed for the VAT-on-margin row.

### `src/pages/investor/InvestorBikePage.tsx`
- Replace the conditional SIV calculation:
  ```ts
  const siv = isMargin ? acquisition + prep * 1.2
            : isVatQualifying ? totalCosts * 1.2
            : totalCosts;
  ```
  with:
  ```ts
  const siv = totalCosts;
  ```
- Remove the now-unused `isVatQualifying` variable if it is only used for SIV. Keep `isMargin` for the VAT row.

## What stays the same
- Net profit, VAT on margin, gross profit, investor share, and headroom logic remain unchanged.
- "Stand-In Value (break-even price)" label stays; only its number changes.
- No database or schema changes.

## Out of scope
- Other pages, reports, or dialogs.