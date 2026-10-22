# Dealer data isolation: audit and lock-down

## Goal
No dealership can ever read or change another dealership's bikes, invoices, customers, parts, numbers or connections, whatever screen, server function or direct request it uses. This is checked by automated tests that fail if anything leaks.

## What we already know (from a database check today)
- Most business tables use a strict "own dealership only" rule that applies on top of every other permission.
- Some tables have a dealership column but **don't** have that strict rule. They need checking one by one: bike activity history, eBay orders, build parts, invoice counters, Squarespace listings, subscriptions, InspectABike connections, Xero/Squarespace sign-in states, and three old backup tables.
- The shared bike catalogue can be **edited** by any signed-in user from any dealership. Reading it is fine because it's shared reference data, but editing it should not be open to everyone.
- Some older permissions only check a person's role (for example "admin can see all profiles") and rely on the dealership rule to narrow the results. That's safe only where the dealership rule exists, so every table needs it.

## Plan
1. **Full inventory.** List every table and classify it as dealership data, shared reference data, platform-only or server-only. Every table with dealership data gets the strict own-dealership rule, applied the same way everywhere.
2. **Close the gaps.** Add the dealership rule to the unscoped tables above. Make sign-in state and connection tables server-only. Make the bike catalogue read-only for dealers. Delete or lock the old backup tables after you confirm.
3. **Make the dealership automatic and unchangeable.** New records always take the signed-in person's dealership, and nobody can move a record into another dealership, even by sending a forged dealership ID.
4. **Server functions.** Audit every server function that uses elevated access (sales, invoices, eBay, Shopify, Xero/QuickBooks, courier, delete bike, staff creation). Each must work out the caller's dealership from their sign-in and check every bike, invoice or part belongs to it before acting. Never trust IDs sent by the browser.
5. **Database helper functions.** Stop signed-out visitors from running privileged helper functions, and limit signed-in users to the ones the app actually needs.
6. **File storage.** Check the photo and logo storage areas so dealers can't list or overwrite each other's files. Public invoice links stay unguessable and show only invoice fields.
7. **Automated cross-dealer tests.** Two test dealerships try to read, edit, insert into and delete from each other's data in every table and server function. Any success fails the test. Run these after every change to the database.
8. **Account safety.** Turn on leaked-password protection and review the 144 existing database warnings, fixing or documenting each one.
9. **Ongoing.** Record the rule in the project's architecture notes: every new table must have the dealership rule plus a cross-dealer test.

## What you'll notice
Nothing changes day to day for dealers. The super admin console keeps its platform-wide summaries through its existing controlled reports, not raw data access.

## Technical details
- A RESTRICTIVE `tenant_scope` policy (`business_id = current_business_id()` OR `is_super_admin()`) goes on every table that has `business_id`. Child tables without the column are scoped through their parent bike or invoice.
- The `set_business_id_default` trigger becomes enforcing: it overwrites the incoming `business_id` on insert, and an update guard blocks any change to it.
- Edge functions use a shared `requireTenant(req)` helper that verifies the JWT, loads the caller's business and asserts ownership of every target row before using the service role.
- `REVOKE EXECUTE ... FROM anon, public` on security-definer functions, with selective grants to `authenticated`.
- Storage.objects policies use a `<business_id>/` path prefix.
- The test suite runs SQL that switches to role `authenticated` and sets JWT claims for each test dealer.
