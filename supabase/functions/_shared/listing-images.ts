export interface BikeImages {
  photos?: string[] | null;
  listing_photos?: string[] | null;
}

const validUrls = (photos?: string[] | null) =>
  (photos ?? []).filter((url): url is string => typeof url === 'string' && /^https?:\/\//.test(url));

/** Dedicated listing images take precedence; existing bike photos remain a safe fallback. */
export function effectiveListingImages(bike: BikeImages): string[] {
  const listing = validUrls(bike.listing_photos);
  return listing.length > 0 ? listing : validUrls(bike.photos);
}