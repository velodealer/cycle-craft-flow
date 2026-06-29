## Changes for mechanic role

**1. Remove Social Planner from sidebar for mechanics**
In `src/components/AppSidebar.tsx`, remove `'mechanic'` from the `socialRoles` array so the entire Social Planner group is hidden for mechanics.

**2. Hide pricing & finance from mechanics**
- `src/components/bike/BikeDetailView.tsx`: When the current user's role is `mechanic`, force `showPricing={false}` (hides the Pricing & Finance card) and also hide the Investor card (which exposes purchase cost / profit share / estimated return).
- `src/pages/BikeDetailPage.tsx` (caller): pass `showPricing={false}` when role is mechanic, OR do the gating inside `BikeDetailView` using `useAuth()` directly — simpler, single place. I'll do it inside `BikeDetailView`.
- `src/components/management/BikeForm.tsx`: hide pricing/finance fields (purchase price, asking price, sale price, VAT scheme, purchase date, and investor cost/profit share inputs) when role is `mechanic`. Form still submits without those fields populated by the mechanic.

**3. Out of scope (not changing)**
- Mechanic still sees the Bikes list, Jobs, Intake, Cleaning, Parts, Logistics, Dashboard (already configured).
- Invoices/Owners/Reports already excluded for mechanics.

### Technical notes
- Role source: `useAuth().profile.role`.
- Pricing card in `BikeDetailView` is already gated by `showPricing`; just add a role check.
- Investor card is currently always shown when `bike.source === 'investor'` — add `&& role !== 'mechanic'`.
