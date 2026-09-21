# Add a Customer Service role

A new staff role for people who prepare bikes for sale: they complete the bike's specification and put it live on Shopify and eBay, without seeing what the business paid or earns.

## What Customer Service can do

- See the bike list and open any bike
- Fill in and edit the full bike specification, including pulling details from 99spokes
- Add and edit parts in the parts/components library and fit them to bikes
- See and edit the asking and sale price
- List, update and remove listings on Shopify and eBay
- Book and track collections and deliveries
- View customer enquiries and website submissions

## What they cannot do

- Purchase cost, prep costs, profit and margin figures stay hidden
- No invoices, reports, quote builder or settings
- Cannot delete bikes, record sales, or change roles and users

## Where it appears

- "Customer Service" becomes a choice when adding or editing a staff member
- Their sidebar shows: Dashboard, Bikes, Parts, Components, Logistics, Submissions, Staff Activity

## Technical notes

- Migration: add `customer_service` to the `user_role` enum (separate statement before it is used in policies).
- Second migration adds the role to the relevant policies: `bikes` (view + manage, no delete), `components`, `bike_components`, `parts`, `ebay_listings`, `shopify_listings`, `bike_collections`, `typeform_submissions`, `bike_activity` insert/select. Tenant `business_id` scoping is unchanged.
- `create-staff-user` edge function: add `customer_service` to `ALLOWED_ROLES`.
- Frontend:
  - `useAuth.tsx` Profile role union gains `'customer_service'`.
  - `AddUserDialog.tsx` / `EditUserDialog.tsx` add the option and badge style.
  - `AppSidebar.tsx` adds the role to Dashboard, Bikes, Parts, Components, Logistics, Submissions, Staff Activity.
  - `BikeDetailView.tsx`: introduce a `canSeeCosts` flag (admin/owner/accountant/detailer) separate from the existing `canSeePricing`. Customer Service gets pricing (asking/sale editing) but not the cost/profit breakdown; the Shopify and eBay cards render for them, while delete, record sale, break-for-parts and admin status controls stay hidden.
  - `BikeActivity` receives `canSeeCosts` so purchase-cost entries stay hidden from this role.
- Existing roles keep exactly the access they have today.
