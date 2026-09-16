# Staff activity by day

A new "Staff activity" page that answers: what did this person do today, and on which bikes.

## What you will see

Pick a person and a date (default: today). You get a timeline for that day, newest first, with each entry showing the time, what happened, and the bike it was on (photo, reference, make/model) — click through to the bike.

Entries come from what the app already records:

- Stage moves — moved a bike from intake to cleaning, cleaning to inspection, etc., including the note typed and any photos attached at the time.
- Inspections — inspection started and inspection completed.
- Repair decisions — a fault approved or declined, with the note.
- Repairs finished — a fault marked repaired (these come back from InspectABike, so the timestamp is shown without a named person).
- Job changes — a repair job assigned to that person, and when its record last changed.

Above the timeline, a small summary for the day: number of bikes touched, stage moves, inspections done, repair decisions.

There is also an "Everyone" view for the chosen day, grouped by person, so you can see the whole team's day on one screen.

## Who can see it

Admin and owner can pick any person. Everyone else sees only their own day — the person picker is hidden for them.

## Honest limits of the current data

Checked the live data before writing this:

- Repair jobs carry an assigned person but no start or finish times at all (0 of 77 jobs have them), so the page can show that work was assigned to someone, not how long it took or exactly when it was done. Capturing start/finish would need mechanics to press Start and Finish on a job — out of scope here, but it is the natural next step if the timeline looks too thin.
- Only 13 stage moves have ever been recorded in total (8 by Jahan), so early days will look sparse. That is a record-keeping gap, not a bug in the page.
- Photo uploads and notes made during a stage move are attached to that stage move, so they will appear.

## Technical notes

- New route `/staff-activity` plus a sidebar entry, in the same pattern as `RepairsPage`.
- Read-only. No schema changes, no migrations, no edge functions.
- Data sources, all filtered on the selected day in the local timezone: `fulfilment_events` (`performed_by`, `timestamp`, `stage`, `notes`), `inspections` (`inspected_by`, `started_at`, `completed_at`), `inspection_faults` (`decided_by`, `decided_at`, plus `repaired_at` as unattributed), `jobs` (`assigned_to`, `created_at`, `updated_at`).
- One hook, `useStaffActivity(profileId | 'all', date)`, queries each source, resolves bike rows once by id, resolves `profiles` names, and merges into a single sorted event list with a discriminated `type`.
- `performed_by` / `inspected_by` / `assigned_to` reference `profiles.id`; `decided_by` is a user id, so it is matched via `profiles.user_id`.
- Non-admin users are locked to their own `profile.id` in the hook, not just hidden in the UI; existing RLS already governs row visibility.
- Reuses `BikeThumbnail` and `bikeRef`; mobile-first card layout consistent with the other lists.
