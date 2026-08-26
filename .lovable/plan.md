# Admin: Delete a Bike and All Associated Data

Give admins a way to permanently remove a bike record together with everything attached to it — workshop jobs, inspections, stage history, components, collection bookings, and uploaded photos.

## Behaviour

- A **Delete bike** button appears on the bike detail page, visible only to users with the admin role.
- Clicking it opens a confirmation dialog listing exactly what will be removed (counts of jobs, inspections, photos, parts, stage events).
- The admin must type the bike's reference (e.g. `BWC-BMC-1234`) to enable the confirm button.
- **Blocked when invoiced:** if any invoice is linked to the bike, deletion is refused and the dialog explains that the accounting record must be handled first (the invoice can be cancelled/unlinked in QuickBooks/Invoices before retrying).
- On success the user is redirected back to the bikes list with a toast confirming removal.

## What gets deleted

| Data | Action |
| --- | --- |
| Invoices | Deletion blocked if any exist |
| Jobs, inspections, stage history, components, collection bookings | Deleted |
| Parts listed against this bike (bookkeeping rows and unsold stripped parts still linked to it) | Deleted |
| Parts already moved to general inventory (no bike link) | Kept |
| Social posts referencing the bike | Kept, bike link cleared |
| Photos in bike-photos, job-photos, fulfilment-photos storage | Files removed |
| The bike row | Deleted |

## Technical notes

- New Supabase edge function `delete-bike` running with the service role, so cleanup happens atomically and is not blocked by per-table RLS. It verifies the caller's JWT and that their profile role is `admin` before doing anything; any other role gets a 403.
- Function steps: load bike → count linked invoices, abort with a clear error if > 0 → collect storage paths from `bikes.photos`, `jobs.photos_before/photos_after`, and fulfilment event photos → `storage.remove()` on each bucket → delete dependent rows (jobs, inspections, fulfilment_events, bike_components, bike_collections, parts where `bike_id` or `stripped_from_bike_id` matches) → null `social_posts.vehicle_id` → delete the bike row.
- No schema migration required: `jobs`, `inspections`, `fulfilment_events`, `bike_components`, and `bike_collections` already cascade from `bikes`; `parts` and `invoices` are handled explicitly in the function.
- New UI component `src/components/bike/DeleteBikeDialog.tsx` (reference-typing confirmation, pre-flight counts) wired into `BikeDetailView.tsx` behind an admin role check, hidden in inspection mode.
- `verify_jwt` stays enabled for this function in `supabase/config.toml`.
