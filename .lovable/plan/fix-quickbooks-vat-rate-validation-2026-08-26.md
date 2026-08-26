# Fix QuickBooks VAT-rate validation

The sale was saved in VeloDealer, but QuickBooks rejected the invoice before creating it. The Edge Function log confirms QuickBooks error 6000 on the invoice request: every sales line must use a VAT tax code that exists in the connected UK QuickBooks company. The current sync sends the generic values `TAX` or `NON`, which are not valid company-specific VAT code IDs here.

## Changes

- Extend the QuickBooks connection API to load the connected company's active sales VAT codes from QuickBooks, including their names and rates.
- Add Standard VAT and No VAT / margin-scheme tax-code selectors to the QuickBooks settings panel, alongside the existing account mappings.
- Persist the selected QuickBooks tax-code IDs in the existing integration settings; do not store any new credentials.
- Update invoice sync to use those mapped IDs instead of the hard-coded `TAX` / `NON` values.
- Validate the mapping before sending an invoice and return a short actionable message if the required VAT code has not been selected.
- Keep the existing accounting behavior unchanged: standard sales use the 20% invoice VAT code; margin-scheme sales use the selected no-VAT line code and continue posting margin VAT separately to the mapped VAT control account.
- Make the failed sync retryable so the already-saved invoice can be sent again after the VAT mappings are saved, without creating a duplicate VeloDealer invoice or sale.

## Technical detail

- Extend `QboSettings` with separate standard-sales and margin/no-VAT tax-code references.
- Add tax-code list/save actions to `quickbooks-oauth` and corresponding typed frontend helpers.
- Update `quickbooks-sync-invoice` to select the mapped code by the bike's finance scheme and preserve its existing QuickBooks invoice update/idempotency handling.
- Add focused Edge Function tests for standard VAT, margin scheme, missing mappings, and retry behavior.
