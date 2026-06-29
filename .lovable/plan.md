
# Investor Bikes & Investor Portal

## 1. Database changes

**Enums**
- Extend `bike_source` enum with `'investor'`.
- Extend `user_role` enum with `'investor'`.

**`bikes` table — add columns**
- `investor_id uuid` — FK to `profiles.user_id` (nullable; required when `source = 'investor'`).
- `profit_share_pct numeric(5,2)` — investor's share of net profit (0–100).
- `purchase_cost numeric(10,2)` — cost basis for net profit calc (nullable, defaults to existing purchase fields if present).

A `CHECK` is avoided; a small trigger validates that when `source = 'investor'`, both `investor_id` and `profit_share_pct` are set.

**RLS additions**
- Investors can `SELECT` from `bikes` where `investor_id = auth.uid()`.
- Investors can `SELECT` related `jobs`, `parts`, `bike_collections`, `invoices`, `fulfilment_events`, and bike photos for those bikes (read-only, scoped by bike_id).
- No write access for investors anywhere.

**Net profit / returns** (computed in the app, not stored):
```
net_profit = sale_price - purchase_cost - sum(parts.cost) - sum(jobs.cost)
investor_return = net_profit * profit_share_pct / 100
```

## 2. Bike form / management UI

`src/components/management/BikeForm.tsx` and `BikeList.tsx`:
- Add **Investor Bike** option to the Source select.
- When source = investor, reveal:
  - **Investor** dropdown (lists profiles where `role = 'investor'`).
  - **Profit share %** numeric input (0–100).
  - **Purchase cost** numeric input.
- `BikeList` filter dropdown gets the new source; badge shows "Investor".
- `BikeDetailView` shows investor name, split %, and a small "Investor return (est.)" card using the formula above.

## 3. User management
- `AddUserDialog` / `EditUserDialog`: add `investor` to the role select.
- `useAuth` Profile type already extended pattern — add `'investor'`.

## 4. Investor portal

New route `/investor` (visible in sidebar only when `profile.role === 'investor'`; other staff roles do not see it; investors do not see the rest of the ops sidebar).

Pages under `src/pages/investor/`:

- **`InvestorDashboardPage.tsx`** (`/investor`)
  - Summary cards: # bikes invested in, # active, # sold, total invested, total returns to date, est. unrealised return.
  - Table of their bikes with current stage badge (intake → cleaning → inspection → repair → ready → listed → sold).

- **`InvestorBikePage.tsx`** (`/investor/bikes/:id`)
  - **Status pipeline** — reuse `StatusProgressBar`.
  - **Financials & returns** — purchase cost, costs to date (parts + jobs), sale price (if sold), their share %, their return.
  - **Activity timeline** — bought date (intake_date), jobs completed (with dates), listed date, sold date, key collection/fulfilment events.
  - **Photos & listing** — gallery from `bike-photos` bucket + asking price / listing notes.

Routing in `src/App.tsx`; sidebar entry in `AppSidebar.tsx` gated on role.

## 5. Out of scope (call out)
- No payouts/ledger table — returns are computed read-only.
- No investor invitations flow; admin creates investor users via existing AddUserDialog.

## Technical notes
- Two migrations are required (enum value commit before use): (1) add `'investor'` to `bike_source` and `'investor'` to `user_role`; (2) add columns, validation trigger, and RLS policies.
- All investor RLS uses `auth.uid() = bikes.investor_id` via a `SECURITY DEFINER` helper `public.is_investor_for_bike(_bike_id uuid)` to keep policies on related tables simple and recursion-free.
- Grants: `GRANT SELECT` to `authenticated` is already in place on the read tables; no new grants needed beyond the new columns being covered by existing table grants.
