# Plan: Intake section on the bike page

## Goal
On the standard bike detail page, add an Intake section (editable form) next to the existing Inspection section, so intake can be completed or reviewed without going to the Intake page.

## Behaviour
- New "Intake" card in the right-hand Tasks column of the bike detail page, placed above the Inspection card.
- Shown when the bike is still at intake stage (`pending_intake` or `intake`): renders the existing intake form pre-filled for this bike, with Save/Process actions. Completing it moves the bike to Cleaning as it does today and refreshes the page data.
- Once the bike has moved past intake, the card collapses to a read-only summary of what was captured at intake (intake date, source, condition, frame number, location, accessories, notes) with an "Edit intake details" toggle for admins so it stays correctable.
- The Inspection card stays exactly as it is; both sections can be visible at once.
- Hidden in inspection mode (mechanic view) so that view stays limited to basic info + inspection.

## Technical notes
- Add a wrapper `src/components/bike/IntakeTask.tsx` that renders `src/components/intake/IntakeForm.tsx` with `preselectedBikeId={bike.id}`, `onSuccess={onUpdate}` and a no-op/hide `onCancel`, wrapped in a Card with a header.
- Minor adjustment to `IntakeForm.tsx`: allow hiding the bike-selection step and the Cancel button when a `preselectedBikeId` is supplied and it is embedded (new optional `embedded` prop) — no change to its save logic.
- Mount `<IntakeTask bike={bike} onUpdate={onUpdate} />` in `src/components/bike/BikeDetailView.tsx` in the Tasks column, gated on `!inspectionMode`.
- No database changes.
