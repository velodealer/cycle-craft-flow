# Update bike label to show frame number

## Goal
Replace the value shown on the printed 4" x 6" bike label's "SERIAL NUMBER" line with the bike's **frame number**, keeping the label text as "SERIAL NUMBER". Confirm the readable code below the QR code remains the generated bike reference (e.g. `BWC-GIA-29C6`).

## What will change
- **src/components/bike/BikeLabels.tsx**
  - Add `frame_number?: string | null` to the `LabelBike` interface.
  - In `LabelContent`, change the "SERIAL NUMBER" line to display `bike.frame_number` instead of `bike.serial_number`.
  - Remove the now-unused `serial_number` field from `LabelBike`.
- **Callers updated to pass `frame_number` into the label data**
  - `src/components/intake/IntakeForm.tsx`: pass `frame_number` (already in local `Bike`) to the label instead of `serial_number`.
  - `src/components/bike/BikeDetailView.tsx`: select `frame_number` and pass it to the label.
  - `src/pages/IntakePage.tsx`: add `frame_number` to `PendingBike` interface and select string.
  - `src/components/management/BikeList.tsx`: add `frame_number` to `Bike` interface and select string.
  - `src/pages/InspectionPage.tsx` and `src/pages/CleaningPage.tsx`: add `frame_number` to local `Bike` interfaces.

## Out of scope / no change needed
- The human-readable code below the QR code already uses `bikeRef(bike)`, which returns the generated reference (e.g. `BWC-GIA-29C6`) when one exists.
- No database schema changes.
- No changes to the QR code URL or label size.
