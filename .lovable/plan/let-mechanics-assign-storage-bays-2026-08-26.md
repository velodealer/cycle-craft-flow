# Let mechanics assign storage bays

## What's happening

Jahan's account has the **mechanic** role. Two things are involved when you type a bay on a bike:

1. Updating the bike's location — mechanics are allowed to do this.
2. Creating the bay record when the typed bay (e.g. "C7") doesn't exist yet — this is currently **admin only**, so it fails with a permission error and the whole save aborts.

So Jahan can only pick bays that already exist, and any new bay silently fails.

## Fix

Allow staff who work with bikes (admin, mechanic, detailer) to create storage bays, while keeping renaming, deactivating and deleting bays admin-only.

- Replace the admin-only insert rule on storage bays with one that also permits mechanics and detailers.
- Leave the existing view / update / delete rules unchanged.

## Extra polish

- In the bay input on the bike page, if saving fails, show the actual error message so the user knows the location wasn't saved (currently the toast can be vague) and revert the field to the previously saved bay.

## Technical notes

- Migration: drop policy `Admins can insert storage bays` on `public.storage_bays`, create a replacement with `WITH CHECK (has_any_role(ARRAY['admin','mechanic','detailer']::user_role[]))` for role `authenticated`.
- Verify `GRANT INSERT ON public.storage_bays TO authenticated` exists; add it if missing.
- `src/components/bike/LocationSelect.tsx`: on error, reset local bay/number state from `current` so the UI doesn't show an unsaved value.
