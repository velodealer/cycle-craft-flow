# Xero integration (full match with QuickBooks)

## What you'll get
- **Settings → Integrations → Xero** card for each dealership: Connect Xero, choose the organisation (if the account has several), pick accounts (stock, cost of sales, sales, VAT, purchase funding) and VAT rates (standard sale, margin-scheme sale), Disconnect.
- **Stock on intake:** when a bike is bought, a stock journal (purchase price only, never prep costs) is posted to Xero.
- **Sales:** recording a sale creates the Xero invoice with the right VAT (standard or margin scheme, or none if the dealership isn't VAT registered), plus the stock-out journal.
- **Reverse a sale:** voids the Xero invoice and journal, the same as QuickBooks.
- **Invoices page:** shows "Xero invoice #…" with Sync / Re-sync next to the QuickBooks line.
- **QuickBooks and Xero can both be connected.** Each posts on its own, and a failure in one doesn't block the other or the sale.
- Health check: the card warns if a mapped account or VAT rate has been deleted or archived in Xero.

## What you need to do (I'll walk you through it after approval)
1. Go to developer.xero.com → My Apps → New app → "Web app".
2. Company URL: `https://velodealer.com`. Redirect URI: `https://api.velodealer.com/functions/v1/xero-oauth`.
3. Copy the Client ID and generate a Client secret, then paste both into the secure form I'll open.

Xero apps are limited to 25 connected organisations until Xero certifies the app (App Partner programme). That's fine for now; I'll note it for later.

## Technical details
- Custom per-dealership OAuth 2.0 (authorization code, scopes `openid profile email offline_access accounting.settings accounting.transactions accounting.contacts`). The Lovable Xero connector isn't suitable because it links one workspace account, not each dealership's own organisation.
- Secrets: `XERO_CLIENT_ID`, `XERO_CLIENT_SECRET`.
- New `_shared/xero.ts` mirroring `_shared/quickbooks.ts`: settings in `integrations` row `name='xero'` per `business_id` (tenant_id, tenant_name, tokens, accounts, tax_types, capabilities); token refresh (Xero refresh tokens rotate on each use and expire after 60 days unused, so the new one is always saved); `XeroReconnectRequired` error; `xero-tenant-id` header on every call; 429 back-off honouring `Retry-After`.
- Edge functions: `xero-oauth` (callback + actions: status, auth_url, tenants, choose_tenant, accounts, tax_rates, save_accounts, save_tax_rates, disconnect with token revoke), `xero-sync-purchase` (ManualJournal), `xero-sync-invoice` (ACCREC Invoice + ManualJournal for stock-out; void on reverse). `verify_jwt=false` for `xero-oauth` in config.toml. OAuth state stored server-side with business_id, 15-min expiry.
- Reuse the existing line/tax/name helpers (`quickbooks-lines`, `quickbooks-tax`, `quickbooks-names`), generalised where they're QuickBooks-specific, so margin VAT maths stays identical.
- Migration (additive): `invoices.xero_invoice_id`, `invoices.xero_journal_id`, `bikes.xero_purchase_journal_id` (nullable text).
- Frontend: `src/lib/xero.ts`, `XeroIntegration.tsx` settings card, and calls added beside the existing QuickBooks ones in RecordSaleDialog, BikeForm (tryPostPurchase), AdminStatusSelect/InvoicesPage (reverse + sync). Each accounting call runs independently and reports its own result.
- Super-admin integration health RPC gains a Xero row.
- Tests: token refresh rotation, tax mapping for standard/margin/non-VAT, journal balance.
- Verify: connect a Xero demo company end to end, post intake, sale, reverse; confirm entries in Xero.
