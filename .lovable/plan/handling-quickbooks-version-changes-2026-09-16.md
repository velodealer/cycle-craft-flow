# Handling QuickBooks version changes

Intuit wants to know what happens when a customer upgrades or downgrades QuickBooks Online and a feature we use appears or disappears. Today the app posts invoices and journal entries and shows a failure message if QuickBooks rejects something. This makes the behaviour deliberate and gives you an answer to paste into the form.

## Answer to paste into the Intuit form

> Yes. On every connection and once a day thereafter, our app reads the company's preferences and account list from QuickBooks Online and stores the resulting feature profile (VAT/sales tax enabled, available tax codes, chart-of-accounts entries used for stock, cost of sales, sales and VAT, and whether journal entries are permitted). The integration is driven by that profile rather than by assumptions about the customer's subscription level, so it adapts automatically when a customer upgrades or downgrades.
>
> If a feature becomes available, the corresponding option is enabled in our settings screen at the next refresh and the customer is prompted to map it. If a feature is withdrawn, we do not attempt the call: the affected postings are held in a pending state rather than failed, the customer sees a plain-English notice in Settings explaining exactly which QuickBooks feature is missing and what to do, and the rest of the sync keeps working. We also treat feature-related API faults at runtime as a signal to re-read the profile, mark the affected item for retry, and surface the guidance rather than repeatedly retrying a call the company cannot support. All calls pin an explicit minor version so payload changes do not break existing customers.

## What I build to make that true

1. A daily and on-connect capability check that reads the company's preferences and accounts from QuickBooks and stores what it finds.
2. Settings shows the detected capabilities and flags anything now missing that the app was previously using, with a short explanation of the impact.
3. When a required capability is missing, sales and purchase postings are held as "waiting on QuickBooks" instead of failing, and are retried automatically once the capability returns.
4. When QuickBooks rejects a call for a feature or account reason, the app re-checks capabilities, marks the item for retry, and shows the guidance instead of a raw error.

## Technical notes

- `supabase/functions/_shared/quickbooks.ts`: add `fetchCapabilities()` (GET `/preferences`, `/companyinfo/{realmId}`, and a `TaxCode`/`Account` query, all at `minorversion=70`) storing `capabilities` + `capabilities_checked_at` in the integration settings; add `requireCapability()` throwing a typed `QboFeatureUnavailable`.
- New edge function `quickbooks-capabilities` (authenticated, admin/owner) to run the check on demand; `quickbooks-oauth` calls it after a successful connect; sync functions call it when older than 24 hours.
- `quickbooks-sync-invoice` and `quickbooks-sync-purchase`: catch `QboFeatureUnavailable` and QuickBooks faults naming a missing account or tax code, set `sync_status`/`purchase_sync_status` to `pending_feature` with a readable `sync_error`, and leave the record retryable.
- `src/components/settings/QuickBooksIntegration.tsx`: capability panel listing detected features, a "Re-check features" button, and a banner when something in use has gone away.
