# Dashboard card counts and links

## 1. Owner approval count (shows 8, should match the approvals page)
Right now the card counts every bike whose stage is "Awaiting owner approval". There are 8 of those, but only 4 of them have repairs waiting for a decision (FOC-8854, TRE-147M, SPE-461M, SCO-584X). The other 4 (BMC-0772, COL-4068, GIA-L072, SPE-ABLE) are sitting in that stage with nothing to approve.
- The card will count bikes with repairs waiting for a decision, the same rule the approvals page uses, so both numbers always match.
- The dashboard will also show a small note like "4 bikes stuck with nothing to approve", with a link to see them, so they can be moved on. Their stage won't be changed automatically.

## 2. Where each card goes
| Card | Goes to now | Will go to |
|---|---|---|
| In intake | Bikes list | Intake page |
| Owner approval | Approvals page | Approvals page (no change) |
| Repair | Approvals page | Jobs page, repair view |
| Ready | Bikes list | Listings page (Ready filter) |
| Listed | Bikes list | Listings page (Listed filter) |
| Sold | Bikes list | Invoices page (sales) |

## 3. Jobs page: repairs grouped by bike
- Jobs are grouped under each bike, like the approvals page: photo, reference, name, stage and bay on top, with that bike's jobs listed underneath.
- Only repair (workshop) jobs show. Cleaning/detailing jobs no longer appear here; they stay on the Cleaning page.
- The Open / Complete / All tabs and the Start / Done buttons keep working as today.
- Clicking the bike name opens the bike.

## Technical notes
- `useBpsDashboardData`: add a query on `inspection_faults` with `status='reported'`, count distinct `bike_id`; also compute pending_approval bikes without reported faults for the stuck note.
- `BPSDashboard.tsx`: update `to` links: `/intake`, `/jobs`, `/listings?status=ready`, `/listings?status=listed`, `/invoices?type=sale`.
- `ListingsPage` and `InvoicesPage`: read the query string to set the starting filter (only if not already supported).
- `JobsPage.tsx`: filter `type = 'workshop'`, group by `bike_id` in memory, render bike header card with `BikeThumbnail` then its jobs. No database changes.
