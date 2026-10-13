export interface BikeImages {
  photos?: string[] | null;
  listing_photos?: string[] | null;
}

const validUrls = (photos?: string[] | null) =>
  (photos ?? []).filter((url): url is string => typeof url === 'string' && /^https?:\/\//.test(url));

/** Only dedicated listing images are sent to marketplaces — intake/workshop photos never are. */
export function effectiveListingImages(bike: BikeImages): string[] {
  return validUrls(bike.listing_photos);
}
