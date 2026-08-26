# Fix intake editing mismatch and lost stage notes/photos

Two confirmed issues.

## 1. "Move to Cleaning" notes and photos are discarded

The stage dialog collects notes and photos, then only updates the bike's status — nothing else is written anywhere. Jahan's notes and photos are gone (photos he uploaded do exist in storage but are not attached to any bike).

Fix:
- On confirm, record a fulfilment event for the bike with the stage, the notes and who performed it.
- Append the uploaded photos to the bike's photo gallery so they show on the bike page.
- Show a stage history list (stage, date, who, notes) on the bike detail page so these entries are visible instead of silently stored.

## 2. Intake section on the bike page doesn't match the intake popup

The intake popup captures: frame number, accessories, general photos, serial-number photo, registration-document photo, and a 5-item completion checklist. The Intake card's "Edit intake details" mode on the bike page only exposes frame number and accessories.

Fix:
- Bring the edit mode in line with the popup: frame number, accessories, plus the three photo uploads (general / serial / registration), each appending to the bike's photos.
- Show the intake photos already captured in the read-only summary.
- Keep the checklist gate only for the not-yet-completed intake flow (the embedded live form), not for later corrections — editing a completed intake shouldn't force re-ticking the checklist or re-uploading photos.

## Technical notes

- `src/components/bike/AdvanceStageDialog.tsx`: insert into `fulfilment_events` (bike_id, stage, notes, performed_by) when the target stage maps to a `fulfilment_stage` value, and merge `photos` into `bikes.photos` in the same submit.
- New `src/components/bike/StageHistory.tsx` reading `fulfilment_events` for the bike, rendered in `BikeDetailView.tsx` (hidden in inspection mode).
- `src/components/bike/IntakeTask.tsx`: extend the edit form with three `PhotoUpload` blocks matching `IntakeForm.tsx`, and render existing photos in the summary.
- No database changes; `fulfilment_events` already exists with the needed columns.
