## Restrict investor access

**Goal:** Investors only ever see their Investor Portal (list of their bikes + bike detail pages for bikes they're invested in). No dashboard, no sidebar items for anything else, no direct-URL access to other pages.

### 1. Sidebar (`src/components/AppSidebar.tsx`)
- When `profile.role === 'investor'`, render ONLY the Investor Portal group. Skip the main "VeloDealer Navigation" group and the Social Planner group entirely.
- Currently `'investor'` isn't in any `navigationItems.roles` array, so the main group already hides — but explicitly short-circuit to be safe and future-proof.

### 2. Default landing for investors
- The current "Dashboard" sidebar entry points to `/` (LandingPage). Investors signing in should land on `/investor`, not the landing page or `/dashboard`.
- In `src/pages/Auth.tsx` (post sign-in redirect) and in `src/pages/LandingPage.tsx` (authenticated visitor redirect), if `profile.role === 'investor'` redirect to `/investor` instead of `/dashboard`.

### 3. Route guard
- Add a small `<RoleGuard>` wrapper in `src/App.tsx` (or a new `src/components/RoleGuard.tsx`) that:
  - Reads `profile` from `useAuth`.
  - If `profile.role === 'investor'` and the current path is NOT `/investor`, `/investor/bikes/:id`, or `/auth`, redirect to `/investor`.
- Wrap all non-investor routes with it. Investor routes render normally. This blocks direct-URL access to `/dashboard`, `/bikes`, `/jobs`, `/settings`, etc.

### 4. Investor bike detail
- `/investor/bikes/:id` (`InvestorBikePage`) already exists and is the investor-scoped detail view — keep using it. Investors will not be routed to the general `/bikes/:id` page.

### Out of scope
- No changes to RLS / Supabase policies (already scoped by `investor_id` on bikes).
- No changes to other roles' visibility.
- No changes to the investor dashboard content itself.
