# Mechanic timeslip: jobs done, loading and lunch

Applies to the Staff activity page (per person, per day).

## What changes
1. **Jobs done list** — a "Jobs done" section for the chosen mechanic and day: every job they completed that day, showing the bike (reference, make, model, clickable), the job title and started/finished times with time taken.
2. **Loading (admin/owner only)** — a "Loading (+3h)" tick for that mechanic on that day. When ticked, a "Loading — 3h" line appears and 3 hours are added to the day total. Mechanics see it but cannot change it.
3. **Lunch** — a fixed "Lunch — 1h" line on every day, shown for information only and not taken off the total.
4. **Day total** — job time + loading (if ticked). Lunch is shown separately.
5. **Credit the right person** — pressing Start or Done on the Jobs page assigns the job to whoever pressed it if nobody is assigned yet, so completed work always shows on the right timeslip.

## Technical details
- New table `staff_day_adjustments` (business_id, staff_id, work_date, loading boolean, created_by; unique on business_id + staff_id + work_date), with grants, RLS scoped to the dealership: staff read their own rows, admin/owner read and write all. The existing trigger fills in business_id; updated_at trigger included.
- StaffActivityPage: load the completed jobs and the adjustment row for the date; upsert when the tick changes; compute totals.
- JobsPage `update`: include `assigned_to: profile.id` when the job has no assignee.
