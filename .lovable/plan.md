## Cleaning page: open bike in a dialog instead of inline view

Mirror the intake page pattern on `/cleaning` so clicking "View & Clean" opens the bike in a popup instead of replacing the page with `BikeDetailView`.

### Changes

**`src/pages/CleaningPage.tsx`**
- Remove the `showDetail` full-page swap. Keep `selectedBike` state but render the list at all times.
- Add a Shadcn `Dialog` controlled by `!!selectedBike`. Inside `DialogContent` (wide, scrollable: `max-w-4xl max-h-[90vh] overflow-y-auto`) with a `DialogHeader` titled "Clean Bike", render the existing `<BikeDetailView ... showPhotos={false} showPricing={false} showDescriptions={false} />`.
- `onBack` and `onUpdate` close the dialog (set `selectedBike` to `null`) and call `loadCleaningBikes()` to refresh the queue.
- "View & Clean" button still calls `handleView(bike)` which fetches the full bike row and sets `selectedBike` — now that just opens the dialog.

### Out of scope
- No changes to `BikeDetailView`, no DB changes, no workflow changes.
