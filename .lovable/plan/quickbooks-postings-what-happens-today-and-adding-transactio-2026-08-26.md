# QuickBooks postings: what happens today, and adding transaction references

## What already happens when you record a sale

Recording a sale (bike → Sold) creates the invoice in VeloDealer and then pushes to QuickBooks:

1. A customer invoice in QuickBooks (created if the customer doesn't exist yet), numbered with the app's invoice number (`INV-000123`).
   - Margin scheme: line is marked no-VAT, gross = sale price.
   - VAT-qualifying: standard 20% tax code on the line.
2. A journal entry that:
   - Credits **Stock/Inventory** by the bike's purchase price (removes it from stock).
   - Debits **Cost of Goods Sold** by the same amount.
   - Margin scheme only: credits **VAT control** with (sale − purchase) × 20/120 and debits Sales by the same amount.

At intake, a separate journal debits **Stock** and credits the **funding account** by the purchase price, so stock in and stock out always net off.

So yes: VAT is posted and stock is reduced automatically, as long as QuickBooks is connected and all five accounts are mapped.

## Referencing — current state and the gap

- Sale invoice: carries the app invoice number as the QuickBooks Doc Number, and the line description holds make, model and bike reference (e.g. `BWC-TRE-1234`).
- Sale journal: bike reference appears in the line descriptions and private note, but the journal has **no Doc Number**, and doesn't quote the invoice number in a structured field.
- Intake (stock in) journal: bike reference is in the description/private note only — again no Doc Number.
- In the app: QuickBooks ids are stored on the bike and invoice rows but aren't shown anywhere, so there's no way to click from a bike or invoice to the matching QuickBooks transaction.

## Proposed changes

1. Give every journal a readable Doc Number so it's searchable in QuickBooks:
   - Stock in: `STK-IN-<bike reference>`
   - Stock out / COGS on sale: `STK-OUT-<bike reference>`
   - Margin VAT lines stay on the same sale journal, so one reference covers the sale posting.
2. Put the cross-reference in the private note of each posting:
   - Intake journal: bike reference, make/model, frame number, intake date.
   - Sale journal: bike reference plus the invoice number it belongs to.
   - Invoice: bike reference plus the intake journal's doc number, so the purchase and sale sides are traceable to each other.
3. Surface the references in the app:
   - Bike page: show "Stock posted — STK-IN-… " with the sync state, and the same for the sale posting.
   - Invoices page: show the QuickBooks invoice number and journal doc number per row, alongside the existing sync status and retry button.

## Technical detail

- `supabase/functions/quickbooks-sync-purchase/index.ts`: add `DocNumber` to the JournalEntry payload and enrich `PrivateNote`.
- `supabase/functions/quickbooks-sync-invoice/index.ts`: add `DocNumber` to the sale JournalEntry, include the invoice number and bike reference in `PrivateNote`, and reference the intake journal doc number on the invoice's `PrivateNote`.
- No schema change needed: `bikes.quickbooks_purchase_journal_id`, `invoices.quickbooks_invoice_id` and `invoices.quickbooks_journal_id` already exist; the doc numbers are derived from the bike reference and invoice number.
- Frontend: display fields in `src/components/bike/BikeDetailView.tsx` and `src/pages/InvoicesPage.tsx`.
- Re-syncing an already posted bike or invoice keeps updating the same QuickBooks record (idempotent by stored id), so doc numbers won't duplicate.
