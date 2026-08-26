# Let mechanics assign storage bays (RLS fix)

## What's happening

Jahan's account has the **mechanic** role. Assigning a bay involves two writes:

1. Updating the bike's location — mechanics are allowed to do this.
2. Creating the bay record when the typed bay (e.g. "C7") doesn't exist yet — the row-level security rule on storage bays currently allows **admins only**, so this is blocked and the whole save aborts.

That RLS restriction on creating bays is the blocker.

## Fix

- Replace the admin-only insert rule on storage bays with one that also permits mechanics and detailers.
- Keep renaming, deactivating and deleting bays admin-only.
- Confirm the table's access grants allow signed-in staff to insert.

## Extra polish

- In the bay input on the bike page, if saving fails, surface the real error message and revert the field to the previously saved bay so it never shows an unsaved value.

## Technical notes

- Migration: drop policy `Admins can insert storage bays` on `public.storage_bays`; create `Staff can insert storage bays` for role `authenticated` with `WITH CHECK (has_any_role(ARRAY['admin','mechanic','detailer']::user_role[]))`.
- Ensure `GRANT SELECT, INSERT, UPDATE, DELETE ON public.storage_bays TO authenticated` and `GRANT ALL ... TO service_role`.
- `src/components/bike/LocationSelect.tsx`: on error, reset local bay/number state from `current`.
