# Fix bike ID on printed label

## Problem
The label shows a fallback code (e.g. `CD52B415`) instead of the real bike ID (`BPS-GIA-E967`). The label helper falls back to a shortened database id whenever the bike's `reference` value isn't supplied — and none of the callers pass `reference` into the label data.

## What will change
- **src/components/bike/BikeDetailView.tsx** — pass `reference: bike.reference` into the label data.
- **src/components/intake/IntakeForm.tsx** — add `reference` to the local bike type/query and pass it into the label.
- **src/pages/IntakePage.tsx** — add `reference` to the pending-bike type and the select list (it currently selects named columns only).
- **src/components/management/BikeList.tsx** — add `reference` to the bike type and select list so bulk label printing gets it.
- **src/pages/InspectionPage.tsx / CleaningPage.tsx** — queries already select all columns; add `reference` to the local types so it flows into the label.

## Result
Every label (single or bulk) prints the generated bike ID under the QR code, e.g. `BPS-GIA-E967`.
