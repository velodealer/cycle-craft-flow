# Production readiness: 62 / 100

The features are broad and dealer data is kept separate. What's missing is proof that it works: most live connections (eBay Live, Xero, QuickBooks syncing, courier webhooks, email) have never been tested end to end. There are few automated checks, and a few safety settings are still off.

## Score breakdown

| Area | Score | Why |
|---|---|---|
| Features | 85 | Covers the whole dealer workflow |
| Data separation between dealers | 80 | Three layers of protection, tested once with a second dealer |
| Security settings | 55 | Leaked-password check off, about 127 older database warnings, sign-in pages have no limit on repeated attempts |
| Reliability of connections | 45 | eBay Live, Xero, Cycle Courier webhooks, Typeform webhooks and invoice syncing are mostly untested live |
| Automated testing | 30 | Only a handful of tests (eBay notifications, titles) |
| Monitoring and recovery | 40 | No alerts when a sync fails silently, no tested backup restore |
| Mobile experience | 65 | Overflow problems are still being found page by page |
| Legal and billing | 60 | Legal pages exist; subscriptions are set by hand, with no card payments |

## Phase 1: Must do before more dealers join (to reach about 80)

1. **Turn on safety settings:** leaked-password protection, and email confirmation on sign-up.
2. **Clear the database warnings:** fix the real ones, and record why the rest are safe to ignore.
3. **Re-run the dealer-separation test** on every table and server function (two test dealers trying to read and change each other's data), and keep it as an automated check that runs every time.
4. **Test every connection live** in a dealer test account:
   - eBay Live sign-in, then list and end a listing
   - QuickBooks and Xero: stock in, sale invoice, part sale, export sale, bike breaking
   - Cycle Courier webhook
   - Typeform webhook (and add the 15-minute backup check)
   - Resend emails: invoice, password reset
5. **Retry failed syncs and alert on them:** a "Failed syncs" list on the dashboard with a Retry button, plus an email to the owner.
6. **Mobile pass:** check every main page at phone width and fix anything that runs off the edge.

## Phase 2: Stability (to reach about 90)

1. **Automated tests for money rules:** VAT (margin, standard, export, not registered), profit, invoice numbering, channel price mark-ups, deferred-job handover block.
2. **Error tracking:** record errors from the app and server functions in a log the super admin can read.
3. **Backups:** check daily backups exist and do one practice restore.
4. **Clean up old leftovers:** remove the backup tables from September 2026, and old integration rows.
5. **Speed:** load long bike and parts lists in pages, and add database indexes on the dealer ID and status fields.

## Phase 3: Commercial polish (to reach about 95)

1. Card payments for subscriptions, so plans aren't set by hand.
2. Dealer data export and account deletion (GDPR).
3. Status page and support-response process.
4. A Help section with short guides for each workflow.

## Technical details

- Security: enable HIBP in Supabase auth, run `supabase--linter`, and turn the tenant test into a script that signs in as two seeded businesses and checks row counts for each `business_id` table plus `assertTenantRow` for each function.
- Failed syncs: use the existing `integration_error_log` plus a status on each record (`qbo_sync_status`, `xero_sync_status`); add a small `failed_syncs` view limited to the dealer.
- Typeform backup: a scheduled function every 15 minutes that fetches responses since the last saved time.
- Tests: Vitest for `src/lib` (quotes, channelPricing, ebayTitle, VAT helpers); Deno tests for `_shared`.

Suggested order: Phase 1 items 1 to 3 first (security), then 4 and 5. Approve to start with Phase 1.
