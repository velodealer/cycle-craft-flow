# Cleaning queue: cleaning-only popup + desktop button fix

## What changes

### 1. "View & Clean" popup shows cleaning details only
- In `src/pages/CleaningPage.tsx`, the popup currently opens the entire bike file (specs, history, listings, collections, etc.) with only prices and descriptions hidden.
- Replace it with a small, focused view:
  - A simple header: bike photo, make / model / year, frame number — so the cleaner knows which bike it is.
  - The cleaning checklist itself (`CleaningTask`): Wash, Degrease & Drivetrain Clean, Polish/Detail, notes, and the complete/save actions.
- Nothing else appears in the popup — no specifications, costs, listings, stage history or collection panels.
- Widen the `CleaningTask` role gate (`src/components/bike/CleaningTask.tsx`) from `detailer`/`admin` only to also include `owner`, so the person managing the shop sees the checklist in the popup too (today it silently renders nothing for owners).

### 2. "View & Clean" button on desktop
- The button already exists in the desktop table code, but the table sits in a horizontally scrolling box, so on narrower desktop windows the Actions column (and the button) is pushed off-screen and only reachable by scrolling sideways.
- Fix the desktop table layout so the Actions column with the "View & Clean" button is always visible without horizontal scrolling (tighten the Location column width and let the bike name wrap instead).

## Technical details
- Files touched: `src/pages/CleaningPage.tsx`, `src/components/bike/CleaningTask.tsx`.
- The full bike fetch in `handleView` stays (the cleaning task needs the bike row), but `BikeDetailView` is no longer rendered inside this dialog.
- No data or workflow changes — completing the checklist still moves the bike on exactly as before.
