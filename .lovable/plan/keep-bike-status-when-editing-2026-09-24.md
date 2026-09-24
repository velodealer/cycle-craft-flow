# Keep bike status when editing

## Cause
The bike edit form sets the status on every save — to "Pending intake" (or "Awaiting collection" if collection is ticked). So editing a price, source (owned/consignment/investor) or any other detail on an existing bike sends it back to intake.

## Fix
- New bikes: unchanged — they still start at Pending intake or Awaiting collection.
- Editing an existing bike: status is left exactly as it was. The only exception is ticking "Arrange collection" while the bike is still at Pending intake, which moves it to Awaiting collection (same as today).
- No other edit changes the stage; stage moves stay with the stage buttons/workflow.

## Technical details
- `src/components/management/BikeForm.tsx` `onSubmit`: only include `status` in `bikeData` when creating (`!bike`), or when editing with `arrange_collection` and `bike.status === 'pending_intake'`.
- Status is then no longer listed in the "Bike details edited" activity entry for plain edits.
- Optional data repair: none automatic — bikes already knocked back can be moved via their stage controls (I can list recently affected bikes from the activity history if wanted).
