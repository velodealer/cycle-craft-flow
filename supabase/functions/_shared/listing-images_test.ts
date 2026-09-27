import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { effectiveListingImages } from './listing-images.ts';

Deno.test('listing images take precedence and keep their order', () => {
  assertEquals(
    effectiveListingImages({
      photos: ['https://example.com/workshop.jpg'],
      listing_photos: ['https://example.com/main.jpg', 'https://example.com/detail.jpg'],
    }),
    ['https://example.com/main.jpg', 'https://example.com/detail.jpg'],
  );
});

Deno.test('bike photos remain the fallback when no listing images exist', () => {
  assertEquals(
    effectiveListingImages({ photos: ['https://example.com/bike.jpg'], listing_photos: [] }),
    ['https://example.com/bike.jpg'],
  );
});

Deno.test('invalid image values are not sent to marketplaces', () => {
  assertEquals(
    effectiveListingImages({
      photos: ['https://example.com/fallback.jpg'],
      listing_photos: ['not-a-url', 'https://example.com/listing.jpg'],
    }),
    ['https://example.com/listing.jpg'],
  );
});