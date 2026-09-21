# Platform console for the super admin

A separate console at `/admin` for running VeloDealer as a business: approving and managing dealerships, tracking their subscriptions, and seeing how the platform is performing. No bike, workshop or stock screens.

## What you get

Signing in as the super admin lands you on `/admin` with its own menu:

**Overview**
- Total dealerships, active / pending / suspended counts
- New sign-ups this month, users across the platform
- Monthly recurring revenue from the subscription records
- Pending approvals and failed integrations listed for action

**Dealerships**
- One row per dealership: name, contact, plan, status, members, bikes on the books, last activity
- Approve, suspend or reactivate
- Open a dealership to see its detail page: staff list, subscription, usage over time, trading figures, connected integrations, and the ability to move a user between businesses

**Subscriptions**
- Manual records you keep yourself: plan name, price, billing period, seats, renewal date, status (trialling, active, past due, cancelled), free-text notes
- Edit inline per dealership; totals roll up into Overview
- No payment processing — built so card billing can be added later

**Analytics**
- Usage and activity: sign-ins, active users, bikes added, jobs completed per dealership, with a period picker
- Trading volumes: stock held, bikes sold, sale values per dealership
- Platform totals: sign-up growth, active accounts, churn, subscription revenue
- Integration health: which dealerships have connected QuickBooks, Shopify, eBay, Cycle Courier, InspectABike, Typeform, and which are erroring

**Inbox** and **Website** — the existing customer enquiries, job applications, blog and job openings, moved here from Settings.

Not included: viewing a dealership's account as them. Left for later.

## Technical outline

Routing and shell
- New `AdminShell` (sidebar + header, reusing the velo design tokens) and routes `/admin`, `/admin/dealerships`, `/admin/dealerships/:id`, `/admin/subscriptions`, `/admin/analytics`, `/admin/inbox`, `/admin/website` in `App.tsx`.
- `SuperAdminGuard`: non-super-admins are redirected to `/dashboard`; super admins hitting `/dashboard` are redirected to `/admin`.
- Settings keeps User Management, System, Integrations, Listing Formats, Storage Bays for dealers. The `inbox`, `website` and `super` tabs are removed; `SupportInbox`, `BlogManager`, `JobOpeningsManager` are reused verbatim in the new pages, and `SuperAdminPanel` is split into the Dealerships pages.

Data
- New `public.business_subscriptions` table (business_id unique, plan_name, price, currency, billing_period, seats, status, trial_ends_at, current_period_end, notes, timestamps), with GRANTs for `authenticated`/`service_role`, RLS enabled, and policies allowing only `is_super_admin()` to read and write.
- Analytics read from existing tables grouped by `business_id` (`bikes`, `jobs`, `invoices`, `profiles`, `integrations`, `*_connections`). Because RLS scopes reads to the caller's business, aggregation runs through new security-definer SQL functions guarded by `is_super_admin()`:
  - `admin_platform_overview()` — counts and MRR
  - `admin_dealership_stats(_from timestamptz, _to timestamptz)` — per-business users, bikes added, bikes sold, sale value, jobs completed, last activity
  - `admin_integration_health()` — per-business connection status per integration
- Existing super-admin RLS on `businesses`, `profiles`, `super_admins` already permits the management actions.

Frontend
- `src/pages/admin/*` pages plus `src/hooks/useAdminData.ts` wrapping the RPCs with react-query.
- Subscription editing via a dialog writing to `business_subscriptions`.
