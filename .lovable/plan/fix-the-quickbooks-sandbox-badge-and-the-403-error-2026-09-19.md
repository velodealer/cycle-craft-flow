# Fix the QuickBooks "sandbox" badge and the 403 error

## What's wrong

Yes — the wording matters. The app only accepts the exact word `production`. With `prod` saved, it falls back to sandbox, so it is sending your production login to the QuickBooks *test* servers. That mismatch is exactly what produces the `ApplicationAuthorizationFailed (403)` error when it tries to load your accounts.

## Fix

1. Change the QuickBooks environment setting from `prod` to `production`.
2. Make the app forgiving in future: accept `prod`, `production` and `live` as the same thing, so a shorthand can't break it again.
3. Redeploy the QuickBooks functions so they pick up the corrected setting.
4. Confirm the badge reads **production**.

## What you'll do afterwards

In Settings → Integrations → QuickBooks, click **Disconnect** then **Connect to QuickBooks** and sign in to your real company. The current connection was made against the test servers, so it must be re-authorised once. After that, loading accounts and posting invoices will work.

## Technical notes

- `supabase/functions/_shared/quickbooks.ts` — `qboEnv()` currently returns `production` only on an exact match; widen to treat `prod`/`production`/`live` as production.
- Update the `QUICKBOOKS_ENVIRONMENT` secret value to `production`.
- Redeploy `quickbooks-oauth`, `quickbooks-capabilities`, `quickbooks-sync-invoice`, `quickbooks-sync-purchase`.
