# Admin manual status override on a bike

Add a status dropdown to the bike detail page so an admin can set any bike status directly, instead of only moving one stage at a time.

## What the user sees

- On the bike page, next to the Status Progress bar, admins get a "Status" dropdown listing every workflow status (Pending intake, Awaiting collection, Collection in progress, In transit, Intake, Cleaning, Inspection, Awaiting owner approval, Repair, Ready for sale, Listed, In stock, Sold, Split for parts).
- Changing it asks for confirmation ("Change status from X to Y?"), then saves and refreshes the page data with a toast.
- Non-admins see no dropdown; nothing else about the existing stage buttons changes.
- The dropdown is hidden in inspection mode, like the rest of the admin controls.

## Notes

- This is a manual override: it only writes the bike status. It does not create invoices, QuickBooks postings, or collection records. Moving a bike to "Sold" this way will not generate a sale invoice — the Record Sale flow is still the correct path for real sales.
- Each manual change is recorded in the bike's stage history as a note so there's an audit trail of who changed it and when.

## Technical detail

- New component `src/components/bike/AdminStatusSelect.tsx`: shadcn `Select` over the `bike_status` enum values plus an `AlertDialog` confirmation; on confirm, `supabase.from('bikes').update({ status })` and insert a `fulfilment_events` row (nearest matching `fulfilment_stage`, note "Manual status change: X -> Y") when the target maps to a fulfilment stage; then call `onUpdate()`.
- Rendered in `BikeDetailView.tsx` in the header/status area, gated by `isAdmin && !inspectionMode`.
- No database or RLS changes: existing admin update policy on `bikes` already permits this.
