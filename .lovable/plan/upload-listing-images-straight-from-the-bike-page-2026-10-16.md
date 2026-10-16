# Upload listing images straight from the bike page

The Listing images section on a bike page gets its own upload area, so you no longer have to open "Manage" (the full bike edit form).

## What you'll see
- A drop zone in the Listing images section: drag several photos onto it, or click it to pick files. Several upload at once, with a progress spinner.
- Each image shows as a thumbnail with remove and move earlier/later buttons. The first image is labelled Main.
- Changes save to the bike straight away. The bike's picture across VeloDealer updates to the new main image.
- The "Manage" button is removed from this section. Editing everything else on the bike still works through the normal Edit button.
- Limit stays at 24 images (eBay's maximum). Extra files beyond 24 are skipped with a message.
- Intake photos are never added here and never sent to marketplaces.

## Technical details
- `PhotoUpload.tsx`: add an optional `dropzone` mode (drag-over highlight, onDrop handling, click-to-browse, image-only filter). Existing callers keep current behaviour.
- `BikeDetailView.tsx`: replace the gallery + Manage button with `PhotoUpload` (bucket `bike-photos`, path `bike-<id>`, `allowReorder`, `dropzone`, max 24); `onChange` updates `bikes.listing_photos`, logs a bike activity entry, then calls `onUpdate`. Hidden for mechanics and inspection mode as now.
- No database changes.
