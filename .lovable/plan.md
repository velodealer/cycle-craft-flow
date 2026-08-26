# Meaningful bike reference IDs

Replace the raw UUID fragment shown around the app (`ID: 3f8a1c2d`) with a readable reference like `BWC-SPE-4821`.

## Format

`PREFIX-BRA-1234`

- `PREFIX` — account-wide prefix set in Settings (e.g. `BWC`), uppercase, 2-6 characters.
- `BRA` — first 3 letters of the bike's make, uppercase, letters only (padded with `X` if shorter).
- `1234` — last 4 characters of the serial number (alphanumeric only, uppercase). If no serial number is recorded, fall back to the last 4 characters of the bike's internal id.

Reference is generated once when the bike is created and stored, so it never changes if the serial is edited later. Uniqueness is enforced; on a collision a numeric suffix is appended (`BWC-SPE-4821-2`).

## Where it appears

- Bike detail header (replaces `ID: <uuid>`)
- Bike list / intake list cards
- Printable bike label (and encoded as the human-readable line under the QR code)
- Listing templates: new `{reference}` token
- Searchable — typing a reference in the bikes search finds the bike

## Settings

New "General" section in Settings with a **Bike reference prefix** field (admin only). Changing the prefix affects newly created bikes only; existing references stay stable. A "Backfill references" button generates references for bikes created before this change.

## Technical notes

- Migration: add `reference text unique` to `public.bikes`; add an `app_settings` key/value table (`key text primary key, value jsonb`) with GRANTs — read for `authenticated`, write restricted to admins via `has_role`.
- Generation lives in a Postgres function `public.generate_bike_reference(make text, serial text, bike_id uuid)` plus a `BEFORE INSERT` trigger on `bikes`, so references are consistent regardless of where a bike is created (intake form, bulk collection intake, admin form).
- One-off backfill statement in the same migration for existing rows.
- Client helper `src/lib/bikeReference.ts` for display fallback (`reference ?? id.slice(0,8)`).
