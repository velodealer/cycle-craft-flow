## Add Parts & Labour from the Bike Detail page

Goal: let admins add a part or a labour/job cost directly from a bike's detail view, so the breakdown updates without leaving the page.

### New component: `src/components/bike/BikeCostsSection.tsx`
Displays existing parts and jobs for the bike with their costs, plus two quick-add forms in dialogs.

**Parts list** (read from `parts` where `bike_id = bike.id`):
- Columns: name, qty, unit cost, line total, remove button.
- "Add part" button → opens dialog with: name (text, required), quantity (number, default 1), cost_price (number, required), supplier (optional). On submit inserts into `parts` with `bike_id`.

**Labour list** (read from `jobs` where `bike_id = bike.id`):
- Columns: title, type (workshop/detailing), status, cost (actual ?? estimated), remove button.
- "Add labour" button → opens dialog with: title (required), type (select workshop/detailing), description (optional), estimated_cost, actual_cost, status (default 'pending'). On submit inserts into `jobs`.

Both forms call a passed-in `onChange()` callback after success so the parent re-fetches costs and the breakdown updates. Toast on success / error.

### Wiring in `BikeDetailView.tsx`
- Render `<BikeCostsSection bikeId={bike.id} onChange={refreshCosts} />` directly above the Pricing & Finance card (only when `canSeePricing`).
- Lift the parts/jobs fetch (already added in last turn) into a `refreshCosts` callback so it can be re-run when the section reports a change.
- Hide the section for `isMechanic` (matches existing pricing gating). Mechanics can still use the existing Jobs/Parts pages.

### Out of scope
- No DB changes (tables exist).
- No edits to existing PartsPage/JobsPage.
- No bulk import; one-at-a-time entry.
- No photo upload on the quick-add forms.
