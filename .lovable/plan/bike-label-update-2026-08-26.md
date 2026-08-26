# Bike label update

## Goal
Update the printed 4" x 6" bike label so the serial number appears in the bike info section, the bike ID appears near the QR code, and all printed dates are removed.

## What will change
- **src/components/bike/BikeLabels.tsx**
  - Add `serial_number` to the `LabelBike` interface.
  - In `LabelContent`, add a **Serial Number** line under the bike info section.
  - Keep the readable bike reference (`bikeRef(bike)`) under the QR code and label it as the bike ID.
  - Remove the date from the footer, leaving only the bike reference (or removing the footer if it becomes redundant).
- **Callers updated to pass `serial_number` into the label data**
  - `src/components/intake/IntakeForm.tsx`
  - `src/components/bike/BikeDetailView.tsx`
  - `src/pages/IntakePage.tsx` (add to `PendingBike` and select string)
  - `src/components/management/BikeList.tsx` (add to `Bike` interface and select string)
  - `src/pages/InspectionPage.tsx` and `src/pages/CleaningPage.tsx` (add to local `Bike` interfaces; queries already use `*`, so only type/interface updates are needed)

## Out of scope
- No database schema changes.
- No changes to the QR code URL or label size.
