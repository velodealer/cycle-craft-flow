# Live numbers on the Dashboard

The Dashboard page currently shows fixed example figures — the bike counts, the "+3 today" style notes, the pipeline list and the revenue box are all typed into the page, not read from your data. This replaces them with real figures.

## What you'll see

**Status cards** — one per stage, each counting the bikes actually in that stage right now:
In intake, Cleaning, Inspection, Awaiting approval, Repair in progress, Ready to list, Listed, Sold this month, plus Jobs in progress (open workshop and detailing jobs).

**Small note under each card** — replaced with a real figure instead of invented text:
- Stage cards: how many bikes entered that stage today.
- Sold: how many sold in the last 7 days.
- Jobs: the workshop / detailing split.

**Total in the heading** — real count of bikes in the system (everything not sold, delivered, collected or broken for parts).

**Processing pipeline card** — counts of bikes that moved Intake to Cleaning, Cleaning to Inspection, and Inspection to Approval in the last 30 days, taken from the stage history.

**Revenue tracking card** — this month's real figures: total from paid invoices, average sale price of bikes sold, and revenue from service/detailing invoices.

**System health card** — Database and Authentication stay as live status indicators; "Last sync" is replaced with the time the dashboard figures were loaded.

While the figures load, each card shows a placeholder so the page doesn't flash wrong numbers.

## Technical notes

- New hook `src/hooks/useBpsDashboardData.ts`: parallel `count: 'exact', head: true` queries against `bikes` grouped by status, `jobs` (open, split by `type`), plus `fulfilment_events` (stage transitions in the last 30 days) and `invoices` (paid this month, by `type`) and `bikes.sale_price` for sold-this-month averages. Returns `{ data, loading, error, reload }`.
- `src/components/BPSDashboard.tsx` rewritten to consume the hook; the hardcoded `bikeStatusCards` / `jobStatusCards` arrays are replaced by derived values. Skeletons during load, an inline retry row on error.
- Status mapping: intake/pending_intake, cleaning, inspection, pending_approval, repair, ready, listed, sold. Sold-this-month uses `sold_at` (falling back to `updated_at` when null).
- Money formatted with the existing `money` helper in `src/lib/reports.ts`.
- No database or schema changes; no other pages touched.
