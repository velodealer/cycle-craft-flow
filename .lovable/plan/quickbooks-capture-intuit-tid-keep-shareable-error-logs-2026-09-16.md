# QuickBooks: capture intuit_tid + keep shareable error logs

## What the check found

- **intuit_tid:** not captured today. Every QuickBooks request goes through one shared helper, but the response headers are discarded.
- **Error logs:** partially. Failures are written to the edge-function logs (console output) and stored on the affected record (`invoices.sync_error`, `bikes.purchase_sync_error`), but there is no central, exportable error log.
- **WebSockets:** not used anywhere in the app. All communication is plain HTTPS request/response — the site talks to Supabase and the QuickBooks API over standard web requests; no live socket connections exist to log or manage.

## Answers for the Intuit form (after this work)

> **2. intuit_tid:** Yes. Every QuickBooks API request captures the `intuit_tid` response header. When a request fails, the tid is included in the error message shown to the user, stored against the affected record, and written to the app's integration error log so it can be quoted to Intuit support.

> **3. Error logs:** Yes. Every QuickBooks failure is recorded in a central integration log (operation, bike/invoice reference, HTTP status, QuickBooks error body, and the intuit_tid) which can be exported and shared with Intuit support for troubleshooting. In addition, the affected record carries a plain-English error message and the edge-function runtime logs retain full request context.

## Work items

### 1. Capture intuit_tid in the shared QuickBooks helper
- `supabase/functions/_shared/quickbooks.ts`: read `res.headers.get('intuit_tid')` on every response.
  - On failure: append `intuit_tid: <value>` to the thrown error message and the console log line.
  - On success: log the tid at debug level so support can trace successful-but-suspect calls.
- No signature changes — callers get the tid automatically through the improved error text.

### 2. Central integration error log
- Migration: new table `integration_error_log`:
  - `id uuid pk default gen_random_uuid()`
  - `integration text` (e.g. `quickbooks`)
  - `operation text` (e.g. `invoice.sync`, `purchase.sync`, `token.refresh`, `capabilities`)
  - `entity_ref text` (bike reference or invoice number, nullable)
  - `status int` (HTTP status, nullable)
  - `intuit_tid text` (nullable)
  - `message text`
  - `detail jsonb` (QuickBooks error body / extra context, nullable)
  - `created_at timestamptz default now()`
  - Grants: `select` to authenticated; `all` to service_role. RLS: admin/owner/accountant read; writes via service role only.
- `_shared/quickbooks.ts`: helper `logIntegrationError(supabase, {...})` that inserts a row (fire-and-forget, never throws).
- Wire into the catch blocks of `quickbooks-sync-invoice`, `quickbooks-sync-purchase`, `quickbooks-oauth`, and `quickbooks-capabilities` — recording operation, entity reference, status, tid, message.

### 3. View/export for support
- Settings → Integrations → QuickBooks card: small "Recent QuickBooks errors" section (admin/owner/accountant) listing the last 20 log rows with tid and timestamp, plus a "Copy log" button that copies them as text for emailing to Intuit support.

## Verification

- Trigger a failing sync in the sandbox (bad account mapping) and confirm: the error message contains the tid, a row appears in `integration_error_log`, and the Settings panel shows it.
- Build stays clean.

## Technical details

- One migration (`integration_error_log` + RLS), edits to `_shared/quickbooks.ts`, three edge functions' catch blocks, `src/lib/quickbooks.ts` (listRecentErrors), `QuickBooksIntegration.tsx` (error panel). Redeploy `quickbooks-sync-invoice`, `quickbooks-sync-purchase`, `quickbooks-oauth`, `quickbooks-capabilities`.
- No websockets involved — nothing changes about how the app communicates.
