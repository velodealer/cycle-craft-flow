# Separate businesses, a super user, and per-business visibility

## Why this is happening today

`broxim0@outlook.com` has the `admin` role, and the current rule on user accounts is simply "any admin can see every account". There is no concept of a business/company anywhere in the system, so all bikes, jobs, invoices, parts and people sit in one shared pool. Fixing visibility means introducing that missing concept.

## What we will build

**1. Businesses**

A new "business" record (name, contact email, status: pending / active / suspended). Every user belongs to exactly one business. Every piece of data — bikes, jobs, invoices, parts, components, owners, quotes, storage bays, social posts, submissions, listings, collections, inspections, settings — is tagged with its business.

**2. Super user**

A separate level above admin, held by named people (not a normal role on the business). A super user can:
- See and approve/reject new business sign-ups
- See, edit and move any user in any business
- See every business's data
- Manage global settings

A new "Super admin" area appears in Settings, visible only to super users. Normal admins never see it.

**3. Admins see only their own people**

An admin's User Management list shows only users in their own business, and adding a user attaches them to that business automatically. Same for every other list in the app.

**4. Approval before access**

A new business signing up lands on a "Your account is awaiting approval" screen and can do nothing else until a super user approves it. Approve/reject/suspend all happen from the super admin area, and suspending locks the whole business out immediately.

## Splitting the existing 9 accounts

I need you to confirm the split. My proposed starting point — correct anything:

| Person | Email | Business |
| --- | --- | --- |
| Abdullah Hussain | abdnhussain@gmail.com | VDMS (super user) |
| Broximo Prestige Steeds | broxim0@outlook.com | Broximo Prestige Steeds |
| Bilal Rahim – Eveloce | eveloce@outlook.com | ? |
| Sulayman Hussain | sulnhussain@yahoo.com | ? |
| Jabir Hussain | jnh096506@gmail.com | ? |
| Jahan | jahan87@live.com | ? |
| Sami Top Tech | samkandr@gmail.com | ? |
| eBay (test) | test@ebay.co.uk | VDMS |
| Shopify (test) | test@shopify.co.uk | VDMS |

All existing bikes and their related records need to go to one business as a starting point — I'll put them in VDMS unless you say otherwise, and anything belonging to Broximo can be moved afterwards from the super admin area.

## A note on the password you sent

I have not written that password into the plan or any file, and I won't store it in the app. Set the super user's password yourself through sign-in / password reset once the change is live. Please also change it, since it has now travelled through chat.

## Technical notes

- New tables: `businesses` (name, contact_email, status, timestamps) and `super_admins` (user_id) — super-user status is never a column on `profiles`, to avoid privilege escalation.
- `business_id uuid` added to `profiles` and to every tenant-scoped table, backfilled from the split above, then set `NOT NULL`.
- Security-definer helpers `current_business_id()` and `is_super_admin()`; every RLS policy on every tenant table is rewritten as `business_id = current_business_id() OR is_super_admin()`, combined with the existing role checks. Grants stay as they are.
- `handle_new_user` changes: the first user of a new sign-up creates a pending business and becomes its admin; invited users inherit the inviter's business.
- Edge functions that use the service role (`create-investor`, sync/webhook functions, listing pushes) must resolve and stamp `business_id` explicitly, since they bypass RLS.
- Frontend: `useAuth` exposes `businessId` and `isSuperAdmin`; a guard component blocks the app for pending/suspended businesses; a new Super Admin tab in Settings lists businesses and all users; `src/lib/superAdmin.ts` (hardcoded email list) is replaced by the `super_admins` table.
- This is a large change across roughly 30 tables and most pages. I'll do it in one migration plus a code pass, and verify by signing in as a non-super admin and confirming only their own users and bikes are visible.
