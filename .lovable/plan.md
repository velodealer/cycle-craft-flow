# Assign bays from existing list only

## The problem

Typing a bay on a bike tries to **create** the bay if it doesn't already exist. Creating bays is admin-only, so Jahan (mechanic) hits a permission error and the assignment fails.

Bays shouldn't be created while assigning — they should already exist, and assigning just picks one.

## Fix

- Change the bay field on bikes (bike detail, lists, intake) from free-text entry into a **picker of existing bays** — searchable dropdown listing the active bays, plus a "No location" option to clear it.
- Remove the auto-create behaviour entirely, so assigning only writes `storage_bay_id` on the bike, which mechanics are already allowed to do.
- Bays continue to be created/edited/deleted by admins in Settings → Storage bays (including the bulk generator).
- If saving fails, show the real error and revert the field to the previously saved bay.

## Technical notes

- Rewrite `src/components/bike/LocationSelect.tsx` as a shadcn Popover + Command combobox over `useStorageBays()` (active bays, natural sort), with a clear option. Drop the `storage_bays` insert.
- No database or RLS changes needed; the admin-only insert policy stays as is.
- Props (`bikeId`, `value`, `onChange`, `className`, `size`) stay unchanged so all current call sites keep working.
