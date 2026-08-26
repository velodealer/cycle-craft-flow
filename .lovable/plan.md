# Bay assignment: explicit Assign button

## The problem

The bay field saves automatically the moment you leave the letter box, so typing just a letter (e.g. "C") immediately tries to assign — and creating a new bay is admin-only, so Jahan's attempt fails.

## Fix

- Keep the two free-text fields (bay letter + number), but **stop saving on blur**.
- Add an explicit **Assign** button next to the fields; pressing Enter in either field also assigns.
- On Assign:
  - If the bay already exists, set the bike's location to it.
  - If it doesn't exist, show a clear message that the bay doesn't exist and must be created by an admin in Settings → Storage bays (no auto-create, so mechanics never hit the permission error).
  - Clearing both fields and pressing Assign removes the location.
- If saving fails, show the real error and revert the fields to the previously saved bay.

## Technical notes

- `src/components/bike/LocationSelect.tsx`: remove `onBlur` commit; add an Assign button (and Enter key handling) that calls the commit logic; drop the `storage_bays` insert path.
- No database or RLS changes needed.
- Props (`bikeId`, `value`, `onChange`, `className`, `size`) stay unchanged so all call sites keep working.
