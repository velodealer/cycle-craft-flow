# Sell a bike: sale details, invoice, QuickBooks sync

## What you'll get

When you move a bike to **Sold**, instead of the plain "Move to..." dialog you get a **Record sale** dialog:

- Sale price (defaults to asking price, but editable — the actual sale price is what's saved)
- Sale date
- Customer: search existing customers, or add a new one inline (name, email, phone, address)
- VAT scheme shown (margin vs VAT-qualifying), with the margin VAT amount calculated live
- Optional notes and photos (same as today's stage dialog)

On save:
1. The bike is marked sold with `sale_price` and sale date stored.
2. An invoice is created in the app (numbered, linked to the bike and customer).
   - Margin scheme: the customer invoice shows **0% VAT**; gross equals the sale price.
   - VAT-qualifying: standard 20% VAT shown on the invoice.
3. The invoice is pushed to QuickBooks Online.
4. A journal entry is posted in QuickBooks:
   - **Stock/Inventory** credited by the bike's **purchase price only** (this reverses the purchase entry made at intake, so stock never carries prep costs).
   - **Cost of Goods Sold** debited by the same purchase price.
   - **Margin scheme only**: the margin VAT (`(sale price − purchase price) × 20/120`) is credited to the **VAT control / liability** account (no VAT on the customer invoice itself).
5. The bike stops counting in in-app stock value and stock aging reports.

The Invoices page (currently a placeholder) becomes a real list: invoice number, bike, customer, net/VAT/gross, status, QuickBooks sync state, with a retry button if a sync failed.

## Logging the purchase at intake

When a bike is added to the site with a purchase price, we post the purchase to the balance sheet:

- **Stock/Inventory (asset)** debited by the purchase price.
- The other side credited to the account you choose in settings (Accounts Payable, Bank, or a Purchases clearing account).

Prep costs (collection, delivery, parts, labour) are **not** capitalised into stock — they stay as expenses and only feed the in-app SIV/profit view.

Rules:
- Posted once per bike, on creation (or on the first save where a purchase price is set); a `quickbooks_purchase_journal_id` on the bike prevents duplicates.
- If the purchase price is later edited, the journal is updated in QuickBooks to match.
- If QuickBooks isn't connected, the bike is flagged "purchase not posted" and can be pushed later from the bike page or the Invoices/Accounting screen.

In-app stock value in Reports also uses purchase price only, matching the ledger.

## QuickBooks setup (what you need to do)

QuickBooks isn't a one-click Lovable connector, so we build the connection ourselves. You'll need to create an app at developer.intuit.com and give me:

- QuickBooks Client ID
- QuickBooks Client Secret
- Whether to start in Sandbox or Production

Then in Settings > Integrations you click "Connect QuickBooks", approve in the Intuit window, and pick which QuickBooks accounts map to **Stock/Inventory**, **Cost of Goods Sold**, **Sales income**, and **VAT control / liability**. Those choices are saved so every sale posts consistently.

The margin VAT is never shown on the customer invoice; it is added to the VAT control account through the journal entry only.

If QuickBooks isn't connected yet, sales still record and invoice normally — they're just flagged as "not synced" and can be pushed later.

## Technical detail

**Database**
- `bikes`: add `sold_at` (timestamptz). `sale_price` already exists.
- `invoices`: add `quickbooks_invoice_id`, `quickbooks_journal_id`, `sync_status` (`pending` | `synced` | `failed`), `sync_error`. Table already has bike, customer, external_customer, type, net/vat_rate/gross, status.
- New `quickbooks_tokens` row stored in the existing `integrations` table (`name = 'quickbooks'`) holding realm id, refresh token and account mappings in `settings`; access tokens refreshed server-side only. Nothing token-related reaches the browser.
- Invoice numbering via a Postgres sequence + `INV-000123` format.

**Secrets**: `QUICKBOOKS_CLIENT_ID`, `QUICKBOOKS_CLIENT_SECRET`, `QUICKBOOKS_ENVIRONMENT`.

**Edge functions**
- `quickbooks-oauth` — start URL + callback exchange, stores refresh token (verify_jwt false only for the callback path).
- `quickbooks-sync-invoice` — JWT-validated; refreshes access token, creates/updates the QBO Customer, creates the Invoice (margin = 0% tax on the line), then posts the JournalEntry for stock-to-COGS plus, for margin schemes, the margin VAT to the VAT control account. It writes ids/errors back onto the invoice row.

**Frontend**
- New `src/components/bike/RecordSaleDialog.tsx`, wired into `BikeDetailView` in place of `AdvanceStageDialog` when the next stage is `sold`.
- Customer picker reusing `external_owners` (search + inline create).
- `src/pages/InvoicesPage.tsx` rebuilt as a real list with detail drawer and "Retry QuickBooks sync".
- `src/components/settings/QuickBooksIntegration.tsx` for connect/disconnect and account mapping.
- Reports/stock value: confirm sold bikes are excluded from stock aging and stock value (currently `StockAgingSection` already filters by stock statuses; sold is excluded — will verify sale-date-based reporting uses `sold_at` rather than `updated_at`).

## Build order

1. Migration (invoice sync columns, `sold_at`, invoice numbering).
2. Record sale dialog + in-app invoice creation + Invoices page.
3. QuickBooks secrets, OAuth flow and settings screen.
4. Invoice + journal push, retry handling, reports check.
