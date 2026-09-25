# Separate repair approvals from workshop jobs

## What changes

### Repairs becomes the approval queue
- Show the Repairs page only to **admins and owners**.
- Show one bike card only while that bike has at least one repair still awaiting a decision.
- Keep all of that bike’s inspection repairs together in the card, so the approver can see the whole inspection before deciding.
- Keep **Approve**, **Decline**, optional notes, undo, costs and the costing view.
- Remove **Mark repaired** and **Mark all repaired** from this page entirely.
- When the final awaiting repair is approved or declined, remove the bike from Repairs. A bike with a mixture of approved and declined repairs is ready for Jobs once every repair has a decision.

### Jobs becomes the repair work queue
- Show workshop jobs for a bike only when none of that bike’s inspection repairs are still awaiting approval.
- Show only approved work; declined repairs never become jobs. Existing manually created workshop jobs with no linked inspection repairs continue to appear.
- Keep **Start** and **Done** here. Completing an InspectABike-linked job continues to update InspectABike first, then completes the local job.
- Use the same bike-card structure as Repairs: photo, bike name and ID, stage, size, colour, storage location, and the repairs grouped inside the card with clear status and dates.
- Keep the Open / In progress / Done / All views and the bike/job totals.

### Navigation and counts
- Repairs appears for admins and owners; Jobs appears for admins and mechanics.
- Keep dashboard links aligned: Owner approval opens Repairs, and Repair opens Jobs.
- Make the approval and repair dashboard counts follow the same bike-level eligibility rules as their destination pages, preventing count/page mismatches.

## Technical details
- Refactor the duplicated bike-card header into a small shared workshop card component used by both pages.
- `RepairsPage` will load reported faults first, identify eligible bikes, then load all inspection faults for those bikes so each approval card has full context.
- `JobsPage` will load workshop jobs plus linked fault states, then exclude bikes that still have any `reported` fault. Bike metadata queried for the card will include photos, stage, size, colour and storage bay.
- Preserve existing tenant isolation and role checks. No database schema change is expected.
- Verify desktop and mobile layouts, mixed approved/declined decisions, a partially approved bike staying in Repairs, the final decision moving it to Jobs, and Start/Done behavior.
