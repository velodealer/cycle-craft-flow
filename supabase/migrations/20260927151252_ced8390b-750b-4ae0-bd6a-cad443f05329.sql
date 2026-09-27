ALTER TABLE public.bikes
ADD COLUMN listing_photos text[] NOT NULL DEFAULT ARRAY[]::text[];

COMMENT ON COLUMN public.bikes.listing_photos IS 'Ordered image URLs used for marketplace listings; first image is primary.';