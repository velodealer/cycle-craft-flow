## Goals

1. Capture more bike data on the Add/Edit form (purchase date, frame number).
2. Make sure size, colour, condition and pricing actually appear on the bike detail view.
3. Give each bike its own dedicated page instead of swapping views inside `BikesPage`.

## 1. Database

Add a new column to `bikes`:

- `purchase_date timestamptz NULL` — date the bike was acquired (nullable, for retrospective entries and existing rows).

No RLS changes needed (existing bike policies cover it).

## 2. BikeForm (`src/components/management/BikeForm.tsx`)

Add two new fields in the "Basic Information" card:

- **Frame number** — text input, optional. Already exists on the `bikes` table but was never wired into the form. Add to the zod schema, `defaultValues`, and the JSX (next to Year/Size/Colour).
- **Purchase date** — Shadcn date picker, optional. Add to the zod schema, `defaultValues` (parse `bike?.purchase_date` to a `Date`), and render in the "Pricing & Finance" card next to Purchase Price. Persist as ISO string on submit.

## 3. Why size / colour / condition / pricing "don't show"

`BikeDetailView` already renders all of these fields conditionally on the value being present. The reason they appear blank for some bikes is that those rows were created before the fields were collected (e.g. via the intake flow), not a render bug. No code change needed beyond making sure the form always collects them (already true today for size/colour/condition; purchase_price/asking_price are already collected too).

We will also add a small "Purchase date" line to the Pricing card in `BikeDetailView` so the new field shows up.

## 4. Dedicated bike detail page

Replace the in-page swap with a real route.

- New file `src/pages/BikeDetailPage.tsx`:
  - Reads `:id` from the URL via `useParams`.
  - Fetches the bike from Supabase (`bikes` by id) with loading + not-found states.
  - Renders `BikeDetailView`, wiring `onBack` to `navigate('/bikes')`, `onEdit` to `navigate('/bikes/:id/edit')` (or opens the edit dialog inline — see below), and `onUpdate` to refetch the bike.
- Add route in `src/App.tsx`: `<Route path="/bikes/:id" element={<BikeDetailPage />} />`.
- `BikesPage`:
  - Remove the `showDetail` / `BikeDetailView` branch and the `handleUpdate` refetch.
  - `handleView` becomes `navigate(\`/bikes/\${bike.id}\`)`.
  - Keep the Add / Edit dialog (`BikeForm`) on the list page for adds. For edits triggered from the detail page, render the same dialog on `BikeDetailPage` (simpler than another route) and refetch on success.

## Files Changed

- `supabase/migrations/<new>.sql` — add `purchase_date` column.
- `src/components/management/BikeForm.tsx` — add frame_number + purchase_date fields.
- `src/components/bike/BikeDetailView.tsx` — render purchase_date.
- `src/pages/BikeDetailPage.tsx` — new dedicated page.
- `src/pages/BikesPage.tsx` — navigate to detail page instead of inline view.
- `src/App.tsx` — register `/bikes/:id` route.
