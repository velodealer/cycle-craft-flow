# Part Exchange Without a Clearing Account

## Goal
Remove the "Part exchange clearing" account mapping entirely. Instead, the part-exchange bike's stock-in journal is funded directly against **Accounts Receivable**, which cancels out part of the sale invoice — so no extra account, nothing to reconcile, and everything stays on the balance sheet.

## How it works

1. **Sale invoice (existing behaviour, kept)**
   - Customer invoice posts for the **full gross sale price** (VAT on the full amount under the margin or standard scheme).
   - The negative "Part exchange allowance" line is removed — the invoice simply shows the full sale value.

2. **Part-ex bike purchase sync (change)**
   - When `acquired_via === 'part_exchange'`, the purchase journal posts:
     - Debit: Inventory/Stock (purchase price of the part-ex bike) → on the balance sheet
     - Credit: **Accounts Receivable** (same customer) instead of the clearing account
   - This credit to AR reduces the customer's outstanding balance by exactly the part-ex value, leaving the cash balance due — matching what the invoice list shows.

3. **Net effect in QuickBooks** (example: £2,000 sale, £500 part-ex)
   - Invoice: AR debit £2,000 (incl. VAT postings)
   - Purchase journal: Stock debit £500 / AR credit £500
   - Customer owes £1,500 cash. Stock on balance sheet includes the £500 bike. No clearing account, no reconciliation.

## Changes

1. **`src/components/settings/QuickBooksIntegration.tsx`** — remove the "Part exchange clearing" account field from `ACCOUNT_FIELDS`.
2. **`src/lib/quickbooks.ts`** — remove `part_exchange` from `QboAccountMap`.
3. **`supabase/functions/_shared/quickbooks.ts`** — remove `part_exchange` from `QboAccounts`.
4. **`supabase/functions/quickbooks-sync-purchase/index.ts`** — for part-exchange acquisitions, credit Accounts Receivable instead of the clearing account. (The AR account is resolved from the customer's open invoice / company default, not from settings.)
5. **`supabase/functions/_shared/quickbooks-lines.ts`** — remove the negative part-ex allowance line from invoice lines; invoice now posts at full gross.
6. **`supabase/functions/quickbooks-sync-invoice/index.ts`** — invoice line uses the full `sale_gross` with VAT calculated on it; drop the allowance line logic.
7. **Tests** — update `quickbooks-lines_test.ts` and any purchase-sync tests: invoice lines contain only the sale line at gross; purchase journal credits AR for part-ex.
8. **App UI (`RecordSaleDialog`, invoices page, bike detail)** — unchanged: still shows gross, part-ex value, and cash balance due, since those are VeloDealer-side figures.

## Verification
- Deno tests pass for line-building and purchase posting logic.
- Build passes.
- Record a test part-ex sale and confirm in QuickBooks: invoice at gross, purchase journal debiting stock / crediting AR, customer balance = cash due, no clearing account required.
