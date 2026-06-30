## Live dashboard counts

Replace the hardcoded `count: "0"` values in `src/components/Dashboard.tsx` with real counts from Supabase.

### Counts per card
- **Bikes** — count of bikes with status in `{intake, cleaning, inspection, repair, ready, listed, in_stock, pending_intake}` (i.e. active stock; excludes `sold` and `split_for_parts`).
- **Parts** — count of `parts` rows where `stock_status='in_stock'` AND `bike_id IS NULL` (matches the Parts inventory list).
- **Workshop Jobs** — count of `jobs` where `status` is not `completed` or `cancelled` (i.e. open jobs).
- **Invoices** — count of `invoices` where `status IN ('draft','issued','overdue')` (unpaid/outstanding).
- **Reports** — leave blank (no count, matches today).
- **Customers** — count of `profiles` with role `owner` + count of `external_owners` (deduped only if it gets noisy; first pass = sum).

### Implementation
- New `useDashboardCounts()` hook in `src/hooks/useDashboardCounts.ts`. Fires five `supabase.from(...).select('id', { count: 'exact', head: true })` queries in parallel and returns `{ counts, loading }`.
- `Dashboard.tsx`: call the hook, derive `count` from it when building `dashboardCards`. Show "—" while loading.
- No schema changes, no UI restructure.

### Out of scope
- Wiring the "Open …" buttons to navigate (they still toast). The user only asked about numbers.
- Replacing the "Coming Soon" quick-action buttons.
