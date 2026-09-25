# Keep each dealership's saved sign-ins private

## What's wrong (checked in the database)

- **Connected services table:** four old "Admins can…" rules check only that the person is an admin, not which dealership they belong to. Rules add together, so **an admin at any dealership can read, change or delete every dealership's connections**. That includes the saved sign-ins for eBay (test and live), QuickBooks, Typeform and Xero, plus the webhook secrets.
- **Even inside one dealership,** the saved sign-ins go to the browser along with the settings. Any admin's browser receives them, although only our server ever needs them.
- **InspectABike connection:** every staff member of the dealership can read its saved sign-in and webhook secret, mechanics included.
- **Cycle Courier connection:** already server-only. No change needed.

## The fix

1. **Remove the four admin rules that ignore dealership.** Replace them with rules limited to the dealership: admins and owners of *their own* dealership can see and change their connection settings. The platform super admin keeps access.
2. **Move saved sign-ins into a private store only our server can read.** This covers access and refresh tokens, eBay's test and live tokens, and webhook secrets. Settings such as chosen accounts, postcode, policies and auto-list stay where they are, so every screen keeps working.
3. **Update the server code for each connection** so it reads and saves sign-ins from the private store. It all goes through one shared helper, so eBay, QuickBooks, Xero and Typeform behave the same way.
4. **Copy the existing sign-ins across, then clear them from the old place.** Nobody has to reconnect.
5. **InspectABike:** staff can still see whether it's connected and its status. The saved sign-in and secret are hidden from browsers.
6. **Settings screens** show "Connected" using a yes/no flag, never the sign-in itself.

## How it will be checked

- As a dealership admin in the browser: only your own dealership's connections come back, with no sign-ins or secrets in them.
- A trial read by an admin of another dealership returns nothing.
- eBay, QuickBooks, Xero and Typeform still work afterwards: the status screen loads, the eBay name check runs, and QuickBooks health checks run.
- Before anything is moved, a backup copy of the connections is taken, with a restore script.

## Technical details

- Migration:
  - Drop the policies `Admins can view all integrations`, `Admins can insert integrations`, `Admins can update integrations` and `Admins can delete integrations`.
  - Add tenant-scoped policies: `business_id = current_business_id() AND has_any_role('{admin,owner}')`, or `is_super_admin()`. Keep `tenant_scope`, but remove its `business_id IS NULL` escape hatch (no rows currently have a null `business_id`).
  - Create `public.integration_credentials (integration_id uuid PK references integrations on delete cascade, business_id uuid, secrets jsonb not null default '{}', updated_at)`. `GRANT ALL TO service_role` only, RLS enabled with no policies, and revoke access from anon and authenticated.
  - Take a backup, `integrations_backup_<date>`, restricted to the service role.
- Data move (run_sql): copy `settings.tokens`, `access_token`, `refresh_token`, `access_token_expires_at` and the `webhook_secret` column into `integration_credentials`, then strip them from `integrations`.
- Add a shared `supabase/functions/_shared/integration-credentials.ts` with `loadSecrets` and `saveSecrets`. Wire it into `_shared/ebay.ts` (`loadIntegration`/`saveSettings` merge and split the slot token fields), `_shared/quickbooks*`, `_shared/xero.ts`, Typeform's OAuth/webhook, and any webhook functions reading `integrations.webhook_secret`. Redeploy every function that imports them.
- InspectABike: `REVOKE SELECT ON inspectabike_connections FROM authenticated`, then `GRANT SELECT (id, business_id, status, last_error, created_at, updated_at, …non-secret columns)`. Check that the frontend doesn't select token columns.
- Frontend: `src/services/integrations.ts` and `EmailNotifications.tsx` must no longer expect secret fields. Status screens rely on the functions' `connected` flags.
- Record the rule in `AGENTS.md`: provider credentials live only in `integration_credentials`, never in browser-readable tables.
