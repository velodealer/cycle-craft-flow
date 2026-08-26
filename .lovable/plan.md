# Show bike photos everywhere

## What's happening now
- Bike lists on the Bikes, Intake, Inspection and Cleaning pages already show a thumbnail of the first photo.
- The Inspection and Cleaning detail popups explicitly hide the Photos card, so a mechanic opening a bike there sees no pictures at all.
- The Logistics list shows make/model only, with no picture.

## Changes
1. Show photos in the Inspection and Cleaning bike popups — the Photos gallery card becomes visible there, so whoever is working on the bike can see the intake pictures.
2. Add a photo strip near the top of the bike detail page (a large main image with small thumbnails), instead of only a gallery lower down the page, so the picture is the first thing you see. Clicking a thumbnail swaps the main image.
3. Add thumbnails to the Logistics list rows so collections show the bike's picture like the other lists.
4. Keep the icon fallback everywhere a bike has no photos yet.

## Technical notes
- `src/pages/InspectionPage.tsx` and `src/pages/CleaningPage.tsx`: drop `showPhotos={false}` on `BikeDetailView`.
- New `src/components/bike/BikePhotoGallery.tsx` (main image + thumbnail strip, selected-index state); render it at the top of the left column in `BikeDetailView.tsx` and remove the standalone lower Photos card, still gated on `showPhotos`.
- `src/components/logistics/LogisticsList.tsx`: include `photos` in the nested `bikes (...)` select and render `BikeThumbnail` in each row.
- No database changes.
