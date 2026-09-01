# 99spokes spec lookup

Replace the current open-catalog lookup with a real 99spokes search so adding a bike
auto-fills the full specification, and add the same lookup to bikes that already exist.

## What you get

**When adding a bike**
- A search box at the top of the bike form: type "Specialized Tarmac SL7 2022", get matching
  bikes from 99spokes with thumbnail, year, brand, model and variant.
- Pick one, choose the frame size, and the form fills in: make, model, year, bike type,
  frame material, colour, weight, electric/suspension/dropper flags, and the full component
  spec (fork, shock, wheels, tyres, drivetrain, brakes, cockpit, saddle/seatpost, e-bike system).
- Anything 99spokes doesn't know is left untouched so you can still type it in.

**Retrospectively, on any existing bike**
- A "Look up spec (99spokes)" button in the Specification section of the bike page.
- Search and pick the matching bike, then a review screen shows every field side by side:
  current value vs 99spokes value, with a tick per row. Rows where you already have a value
  are unticked by default; empty rows are ticked. Apply writes only the ticked rows.

**If 99spokes has nothing**
- The existing open bicycle catalog stays as a fallback tab so nothing regresses.

## Technical notes

- **Secret**: `NINETYNINE_SPOKES_API_KEY`, requested via the secure secret form. The key is
  never used from the browser.
- **Edge function** `spokes-lookup` (`supabase/functions/spokes-lookup/index.ts`):
  - `POST { action: 'search', query, limit }` → proxies the 99spokes bike search.
  - `POST { action: 'get', id }` → full bike record including components and sizes.
  - Zod-validated input, JWT verified in code, CORS headers, and provider status/body relayed
    verbatim on failure. Auth header and exact paths taken from api.99spokes.com/docs at build
    time; a `whoami`-style call is made first to confirm the key and header shape work.
  - Short in-memory cache per bike id to limit API calls.
- **Mapper** `src/lib/spokes.ts`: converts a 99spokes bike into
  `{ bikeFields, specValues }` matching the existing `SPEC_SECTIONS` paths in
  `src/lib/bikeSpec.ts` (frame.material, fork.travel_mm, drivetrain.groupset/speed,
  brakes.type/rotor sizes, wheels.wheel_size, ebike.motor_* and battery_wh, etc.), plus
  `applyTypeDefaults` for the boolean flags.
- **UI**
  - `src/components/management/SpokesLookup.tsx` — search + size picker, reused in both places.
  - `src/components/management/BikeCatalogLookup.tsx` gains tabs: "99spokes" (default) and
    "Open catalog" (current behaviour).
  - `src/components/bike/SpokesApplyDialog.tsx` — the field-by-field review/apply table,
    launched from `BikeSpecificationSection.tsx`; writes `spec_values` plus the changed bike
    columns in a single update.
- No database changes: everything lands in existing `bikes` columns and the `spec_values` JSONB.
