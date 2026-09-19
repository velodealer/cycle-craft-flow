# VAT-registered switch

Let a dealership say it is not VAT registered, then hide every VAT figure, field and label across the app and post clean, VAT-free numbers to QuickBooks.

## The setting

A single switch in Settings: "This business is VAT registered" (on by default, so nothing changes for current dealerships). It sits in the Finance area of Settings and is repeated on the QuickBooks card at the moment of connecting, since that is where it matters most.

It is saved per dealership, so one dealership turning it off never affects another.

## What changes when it is turned off

Selling a bike
- The sale dialog drops the VAT scheme choice, the "inc. VAT" wording, the invoice VAT line and the margin VAT line. The customer pays the sale price, plus delivery if charged, minus any part exchange.
- Invoices are recorded with zero VAT and the full amount as the net value.

Invoices
- The VAT column and the "VAT 20%" text in the list disappear; totals stay correct.

Quote builder
- The VAT scheme selector, the VAT-on-parts row and the VAT total row are removed. The quote totals become cost, price and profit only.

Bike records
- The VAT scheme field disappears from the bike form and from the bike record page; new bikes are stored on the non-VAT basis.
- The cost/profit breakdown drops the margin VAT deduction, so profit is simply price minus all costs.

Reports
- The "Profit by VAT scheme" chart and the "Avg VAT rate" figure are hidden. Every other number is unaffected because they are all computed from actual amounts, not VAT.

QuickBooks
- The VAT control account and the two sales VAT code pickers are hidden, and are no longer required to connect or to post.
- Invoices post with no tax applied, and the sale journal moves stock to cost of sales with no VAT line at all.
- Bike purchases at intake already carry no VAT, so they are unchanged.

Shopify / eBay
- Orders that arrive from Shopify are recorded at 0% VAT instead of 20%.

## Existing records

Invoices already raised keep the VAT figures they were saved with — nothing is rewritten. Only new activity follows the new setting.

## Technical notes

- New per-business setting stored in `app_settings` under key `vat_registered` (boolean, defaults to true when absent). Read through a small `useVatRegistered()` hook for the frontend, and read directly from `app_settings` inside edge functions using the business id already resolved there.
- New component `src/components/settings/VatSettings.tsx`, mounted in the Finance/System section of `SettingsPage.tsx`, with a mirrored switch in `QuickBooksIntegration.tsx`.
- Frontend gating: `RecordSaleDialog.tsx` (totals block forced to `vatRate: 0`, `invoiceVat: 0`, `marginVat: 0`, net = gross), `InvoicesPage.tsx`, `QuoteBuilderPage.tsx` (scheme fixed to a new `none` behaviour in `src/lib/quotes.ts` returning zero VAT), `BikeForm.tsx`, `BikeDetailView.tsx`, `BikeCostBreakdown.tsx`, `ProfitabilitySection.tsx`, `CashflowSection.tsx`.
- Edge functions: `quickbooks-sync-invoice` skips `taxCodeForScheme`, sets `GlobalTaxCalculation: 'NotApplicable'`, and omits the margin VAT journal lines when the business is not VAT registered; `shopify-webhook` sets `vat_rate: 0`.
- No schema migration needed — `app_settings` is already business-scoped with the right policies and grants.
