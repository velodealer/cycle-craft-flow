# Part exchange on a bike sale

## What you'll get

The **Record sale** dialog gains a "Part exchange" toggle. When switched on you capture:

- Make, model, frame number (optional), colour/size (optional)
- Agreed part-exchange allowance (£)
- VAT scheme for the incoming bike (Margin scheme or VAT qualifying)

Totals shown live:

```text
Bike sale price          £4,000.00
Part exchange allowance -£1,200.00
Cash balance due         £2,800.00
VAT (margin scheme)      calculated on the FULL £4,000, not the £2,800
```

On save:

1. The sold bike is marked **Sold** at the full sale price (not the cash balance), with the sale date.
2. One invoice is raised for the customer with two lines: the bike at full price, and a negative **Part exchange allowance** line. Invoice total = cash balance due.
3. A new bike record is created from the part-ex details at **Intake** status, with its purchase price set to the allowance and its own VAT scheme. It then flows through the normal cleaning/inspection workflow and can be completed later from the bike page.
4. Both bikes are posted to QuickBooks: the sale (invoice + stock-out/COGS/VAT journal) and the part-ex bike's purchase (stock-in journal, funded by the sale rather than by cash).
5. The bike page and invoice show the link between the two bikes ("Taken in part exchange against INV-000123" / "Part exchange: <ref>").

## VAT rules applied

- **Sold bike on margin scheme**: margin VAT = (full sale price − acquisition cost) x 20/120. The part-exchange allowance does not reduce the margin — it is consideration received in kind.
- **Sold bike on VAT qualifying**: 20% VAT on the full sale price. The part-exchange line is shown as a payment in kind with no VAT on it, so output VAT stays on the full amount.
- **Incoming part-ex bike**: its own scheme is stored on the new bike record and drives VAT when that bike is later sold. Margin scheme is the default; VAT qualifying is selectable when the customer is VAT registered and provides a VAT invoice.

## QuickBooks postings

For a £4,000 margin-scheme sale with a £1,200 part exchange, purchase cost £2,500:

| Posting | Debit | Credit |
| --- | --- | --- |
| Invoice (customer) | Debtors £2,800 | Sales £4,000, Part-ex allowance line −£1,200 |
| Stock out journal | COGS £2,500 | Stock £2,500 |
| Margin VAT journal | Sales £666.67 | VAT control £666.67 |
| Part-ex stock in journal | Stock £1,200 | Part-exchange clearing £1,200 |

The invoice's negative part-exchange line posts to the same **part-exchange clearing** account, so the clearing account nets to zero once both sides are posted and the balance sheet carries the new bike at £1,200.

You will map one extra account in **Settings → Integrations → QuickBooks**: **Part exchange clearing** (an other current asset/liability or a purchases clearing account). If it isn't mapped, the sale still records in the app and is flagged "not synced" as today.

## Technical detail

**Database (one migration)**
- `bikes`: add `part_exchange_invoice_id uuid references public.invoices(id)` and `acquired_via text` (`purchase` | `part_exchange`), so part-ex intakes are identifiable in reports.
- `invoices`: add `part_exchange_bike_id uuid references public.bikes(id)` and `part_exchange_value numeric`.
- `invoices.gross/net/total` store the cash balance; a new `sale_gross numeric` column stores the full sale value so VAT and reporting use the full amount.
- No new tables, so no new RLS surfaces; existing invoice/bike policies apply.

**Frontend**
- `src/components/bike/RecordSaleDialog.tsx`: part-exchange toggle, minimal part-ex bike fields, scheme select, live cash-balance and VAT summary. On submit it creates the part-ex bike (status `intake`, `source: 'owned'`, `purchase_price` = allowance, `finance_scheme` from the select, `acquired_via: 'part_exchange'`), then the invoice, then updates the sold bike, then triggers both syncs.
- `src/pages/InvoicesPage.tsx`: show sale value, part-ex value and balance due.
- `src/components/bike/BikeDetailView.tsx`: badge/link on the part-ex bike back to the originating invoice and sold bike.
- `src/components/settings/QuickBooksIntegration.tsx` and `src/lib/quickbooks.ts`: add the `part_exchange` account to the mapping UI and `QboAccountMap`.

**Edge functions**
- `_shared/quickbooks.ts`: add `part_exchange` to `QboAccounts`.
- `quickbooks-sync-invoice`: build the invoice from two lines (full sale at the scheme's tax code, negative allowance line at the no-VAT code posting to the part-exchange clearing account); base margin VAT on the full sale value; keep the existing stock-out/COGS journal on purchase price.
- `quickbooks-sync-purchase`: when the bike is `acquired_via = 'part_exchange'`, credit the part-exchange clearing account instead of the normal purchase funding account, and use `STK-IN-<ref>` as today.
- Deno tests for the two-line invoice build and the funding-account selection.

## Build order

1. Migration (part-ex columns on bikes and invoices).
2. Record sale dialog with part exchange + part-ex bike creation + invoice with negative line.
3. QuickBooks: clearing account mapping, invoice line changes, purchase funding switch, tests.
4. Invoices page and bike page cross-links.
