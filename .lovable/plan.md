# Dashboard submissions and job-count clarity

## Goal
Add a dashboard card for active customer submissions and make the jobs card accurately describe its current live value.

## Changes
- Add an **Active submissions** card linking to `/submissions`.
- Count submissions with status `new` or `reviewed`; exclude converted and rejected submissions.
- Load this count with the dashboard’s existing data request and include its loading/error handling.
- Keep **Jobs in progress** sourced from current database rows whenever the dashboard loads or Retry is used.
- Rename or split the jobs wording so it is clear the current total includes both pending and started jobs, while retaining the workshop/detailing breakdown.
- Preserve the existing dashboard layout on mobile and desktop.

## Verification
- Compare the active-submission card against the Submissions page using the same statuses.
- Confirm the jobs total equals pending plus in-progress workshop and detailing jobs.
- Verify both cards open the correct pages and the dashboard passes type and preview build checks.

## Technical notes
- No database change is required; `typeform_submissions.status` and the existing jobs query provide the values.
- Values refresh on page load or Retry, not through a continuous real-time subscription.
