# Switch QuickBooks from sandbox to production

## What you'll do (Intuit side — I can't do this part)

1. Go to your Intuit developer account → your VeloDealer app → **Keys & OAuth → Production** and copy the **production Client ID and Client Secret** (they're different from the sandbox keys).
2. In the same place, make sure the redirect URI `https://api.velodealer.com/functions/v1/quickbooks-oauth` is listed for production.
3. Intuit may ask you to complete the production checklist first (app name, EULA/privacy links — we already have those pages live at /terms and /privacy).

## What I'll do (app side)

1. Open the secure form for you to paste the **production** `QUICKBOOKS_CLIENT_ID` and `QUICKBOOKS_CLIENT_SECRET`, and set `QUICKBOOKS_ENVIRONMENT` to `production`.
2. No code changes are needed — the app already reads these settings and talks to the production QuickBooks API when the environment is `production` (`supabase/functions/_shared/quickbooks.ts`).

## What happens then

- The current connection points at your **sandbox company**, so after the switch you'll click **Disconnect** then **Connect to QuickBooks** once in Settings → Integrations → QuickBooks, and sign in to your real QuickBooks company.
- The Settings card shows an "environment" badge — it will read `production` after the switch.
- Invoices, stock and VAT postings from then on post to your real company file.

## Worth knowing

- Anything already synced lives in the **sandbox** company and won't carry across. The production company starts clean — if you want existing invoices re-posted to the real company after reconnecting, tell me and I'll add a re-sync.
- If the sandbox and production apps in Intuit are actually the same keys (some accounts share them), the switch is just the environment setting — the secure form will confirm either way.
