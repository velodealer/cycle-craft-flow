# Add listing images to every bike

## What will change
1. Add a separate **Listing images** collection to each bike. These uploads remain independent from the bike’s existing workshop/intake photos.
2. Show the listing-images gallery on the bike page, with upload, removal and ordering controls available when editing the bike.
3. Treat the first listing image as the main marketplace image and preserve the chosen order.
4. Use the ordered listing images for both eBay and Shopify. If a bike has no listing images yet, continue using its existing bike photos so current listings are not disrupted.
5. Update eBay’s preview, photo checks and publishing payload to use the same effective image set.
6. Update Shopify publishing so syncing an existing product also refreshes its images, rather than only adding images when the product is first created.
7. Keep each platform’s current limits: up to 24 images for eBay and 10 for Shopify. Show the limits clearly in the bike’s listing-images section.

## Data and access
- Add an ordered `listing_photos` URL array to each bike.
- Reuse the existing bike-photo storage and dealership-scoped bike access rules; no public or cross-dealership access is added.
- Existing `photos` data is left unchanged.

## Validation
- Verify upload, removal and reordering on a bike.
- Verify the bike page displays the saved order and first/main image.
- Verify eBay previews and checks use listing images, with general photos as fallback.
- Verify Shopify and eBay create/sync requests use the correct ordered image set.
- Check mobile and desktop layouts, type safety, tests and the preview build.
