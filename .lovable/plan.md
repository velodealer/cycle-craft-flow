# Fix listing images not saving, and Edit bike wiping them

## What's going wrong
1. **Edit bike works from an out-of-date copy.** When you add listing images on the bike page, they save, but the page's own copy of the bike isn't refreshed. Edit bike opens from that old copy, so its listing images grid shows the old set. When you click Save, it writes that old set back over the images you just added. That's how they disappeared.
2. **"Before you list" on the eBay card doesn't refresh.** It reads the bike's images once when the page opens, and never again after you upload.
3. **Uploading while something else changes can lose images.** If you drop a second batch, reorder, or remove an image while an upload is still running, the upload finishes with the list as it was when it started and overwrites the change.
4. **Some failed saves don't tell you.** If the save doesn't actually change the bike, there's no error, so it looks saved when it isn't.

## Fixes
- After any listing-image change on the bike page, reload the bike. Edit bike and every other card then show the current images.
- The eBay card re-checks images and re-runs "Before you list" whenever listing images change.
- Uploads add to the latest list, not the one from when they started. Uploading, reordering and removing can overlap without losing images.
- Edit bike only saves listing images or intake photos if you changed them in that form. A plain edit (price, details) never touches images again.
- If the save doesn't change the bike, show "Could not save listing images" and put the grid back how it was.
- Intake photos get the same fixes.

## Technical details
- `BikeDetailView.saveListingPhotos`: use a functional/ref-based latest list, `.update(...).select('id')` and treat 0 rows as an error, then call `onUpdate()` (BikeDetailPage `fetchBike`).
- `PhotoUpload.uploadFiles`: apply uploaded URLs to a ref holding the current `photos` prop, not the value from when the upload started.
- `BikeForm`: track `photosDirty`/`listingPhotosDirty`, include `photos`/`listing_photos` in the update payload only when dirty.
- `EbayListingCard`: accept a `listingPhotos` prop (or key on it) and reload image state + preview when it changes.
- Verify: typecheck, then Playwright signed-in on BPS-BMC-1044 if a session can be minted. Upload, open Edit (images present), save a price change, and check the images are still there.
