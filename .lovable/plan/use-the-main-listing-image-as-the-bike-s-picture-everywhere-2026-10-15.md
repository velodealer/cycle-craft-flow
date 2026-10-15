# Use the main listing image as the bike's picture everywhere

## What changes
When a bike has listing images, its first listing image (the "main" one) becomes the picture shown for that bike across VeloDealer: the Bikes list (all layouts), search results, Intake, Cleaning, Inspection, Jobs/Repairs cards, Logistics and Listings. Bikes with no listing images keep showing their first intake photo, and then the bike icon as before.

Reordering listing images (making another one the main) updates the picture everywhere straight away.

Not changing: the intake photo gallery on the bike page, cleaning/inspection photo sections, and marketplaces (still listing images only, never intake photos). Form submissions keep their own uploaded photos.

## Technical details
- `BikeThumbnail` gains an optional `listingPhotos` prop; source = `listingPhotos[0]` else `photos[0]` else icon.
- Pass `bike.listing_photos` at every bike call site: BikeList (3), WorkshopBikeCard, CleaningPage (3), InspectionPage (2), IntakePage, SearchBar, LogisticsList (2). ListingsPage already uses listing images.
- Add `listing_photos` to any select queries feeding those views that list columns explicitly (SearchBar, Logistics, workshop queries).
- Display-only fallback; marketplace rule (listing_photos only) untouched.
