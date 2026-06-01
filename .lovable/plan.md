# Intake page: show bikes awaiting intake

Replace the placeholder cards on `/intake` with a real list of bikes that need to be intaken, plus real counts.

## Changes

**`src/pages/IntakePage.tsx`**
- On mount, query `bikes` where `status in ('pending_intake', 'intake')`, ordered by `intake_date` ascending.
- Also query counts for: pending (`pending_intake` + `intake`), today's intakes (`status` advanced past `intake` with `intake_date::date = today`), and this week (last 7 days). For simplicity, derive "Today" and "This week" from `bikes.intake_date` regardless of current status.
- Layout:
  - Keep "Start New Intake" CTA card at the top.
  - Replace the two placeholder cards with a real **Quick Stats** card driven by the queries above.
  - Add a new **Bikes awaiting intake** section below the grid: a list/table of bikes with make/model, source badge, frame number (if any), arrived date, and a "Process intake" button that navigates to `/bikes/:id` (where the existing "Move to next stage" flow handles advancement).
  - Empty state when none are pending.
- Add a small `loading` skeleton while fetching.

## Out of scope
- No DB schema changes.
- Don't change `IntakeForm` — the existing "Start New Intake" CTA still opens it for fresh bikes added directly at intake.
- Don't change the bike workflow itself; the list just routes to the detail page where staging already works.

## Technical notes
- Use the existing `supabase` client from `@/integrations/supabase/client`.
- Reuse Shadcn `Card`, `Badge`, `Button`, `Skeleton`.
- `useNavigate()` from `react-router-dom` for the row action.
