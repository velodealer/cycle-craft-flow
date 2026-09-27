# Allow deferring any repair

Right now the Defer button is hidden on jobs whose wording matches the safety word list (brakes, forks, frame, rims, tyres and so on). You want owners and admins to be able to defer any job.

## What changes

- The Defer button appears on every open job for owners and admins, including safety-related ones.
- A reason is still required, and every defer is still recorded in the bike's history.
- When the job matches a safety word, the defer box shows a short warning line ("This is safety-related work — confirm it is safe to sell before deferring") so the list still has a purpose. Nothing is blocked.
- Settings keeps the safety word list; it now drives that warning instead of hiding the button.

## Technical notes

- `src/pages/JobsPage.tsx`: drop the `isDeferrable(job, keywords)` gate around the Defer button; keep `canDefer` (owner/admin) and the open-status check. Pass the matched-keyword flag into the defer dialog to show the warning.
- `src/lib/deferredJobs.ts`: keep `isDeferrable` as the keyword-match helper (used for the warning only); no signature change needed.
- `src/components/settings/DeferralSettings.tsx`: update the helper text to say the list flags a warning rather than preventing deferral.
- No database or edge function changes; the owner/admin + reason trigger stays as is.
