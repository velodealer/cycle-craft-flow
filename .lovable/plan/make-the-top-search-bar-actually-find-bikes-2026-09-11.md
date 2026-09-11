# Make the top search bar actually find bikes

## What's wrong

The search box in the header was never wired up. Typing a bike name and pressing enter only
pops up a "Search executed" message — it never looks anything up. (Confirmed: the search
component contains a placeholder with a "TODO: implement actual search".)

The search box inside the Bikes page does work, but it only filters bikes already loaded on
that page, and it doesn't match frame numbers.

## What I'll build

**Header search becomes a real, live search**
- As you type (after 2 characters), a dropdown shows matching bikes with photo, name, year,
  reference, status and location.
- Matches on: bike reference, make, model, frame number, serial number, colour, size, and the
  owner/customer name (both staff-managed owners and external customers).
- Clicking a result opens that bike's page; Enter opens the first result.
- Escape or clicking away closes it; shows "No bikes found" when nothing matches.
- Results are limited to 10, sorted newest first, and requests are debounced so typing stays smooth.

**Bikes page search**
- Also match frame number and serial number, and search the whole inventory rather than only the
  currently filtered page load.

## Technical notes

- New hook `src/hooks/useBikeSearch.ts`: debounced (250ms) Supabase query on `bikes` using
  `.or()` with `ilike` across `reference, make, model, frame_number, serial_number, colour, size`,
  joined to `profiles` and `external_owners` for owner-name matching (separate id lookup then
  `in` filter, since PostgREST can't `or` across joined tables). `limit(10)`, ordered by
  `created_at desc`. Existing RLS on `bikes` governs visibility, so each role only sees what
  they're allowed to.
- Rewrite `src/components/SearchBar.tsx` to use the hook, render results in a `Popover`/absolute
  dropdown reusing `BikeThumbnail`, and navigate with `useNavigate`. Keep the current styling and
  the clear (X) button.
- Update the search filter in `src/components/management/BikeList.tsx` to include
  `frame_number` and `serial_number`.

## Verification

- Drive the preview at 360px and 1280px: type a known make and a frame number, confirm the
  dropdown lists the bike and clicking it lands on `/bikes/:id`.
- Confirm empty state and that the build stays clean.
