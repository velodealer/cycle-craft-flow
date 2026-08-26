# Make the prefix change apply to existing bikes

## What's happening now

The backfill button only touches bikes that have **no** reference at all (it filters to empty references). Every existing bike already has one, so changing the prefix updates nothing — matching the note under the button ("existing references stay the same").

## What to build

In Settings → Bike Reference, replace the single button with two clearly-labelled actions:

1. **Backfill missing references** — unchanged behaviour, only fills bikes without a reference.
2. **Re-generate all references** — rebuilds the reference for every bike using the current saved prefix, brand and frame number. Guarded by a confirmation dialog warning that previously printed labels and QR codes will no longer match the on-screen ID.

Other details:
- Re-generate saves the prefix first (so you can't regenerate with an unsaved value), then rewrites references in batches, keeping the existing duplicate-suffix logic so no two bikes clash.
- Show a progress/result toast with the number of bikes updated.
- Update the helper text to explain that a prefix change applies to new bikes unless you re-generate.

## Technical notes

- File: `src/components/settings/BikeReferenceSettings.tsx`.
- New `regenerateAll` handler: select `id, make, frame_number` for all bikes (paged at 1000 rows to avoid the default row cap), clear the uniqueness set, build each reference with `buildBikeReference`, and update rows in chunks.
- Uses frame number (not `serial_number`) for the last-4 segment, to match what labels now show.
- Wrap in shadcn `AlertDialog` for the confirmation.
- No database changes required.
