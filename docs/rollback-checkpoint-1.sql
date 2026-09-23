-- Rollback for Checkpoint 1 (fitted-parts additive schema), 2026-09-23.
-- Safe while the new columns are unpopulated. If overrides have been written since,
-- export them first: COPY (SELECT id, brand, model, mpn, attributes, spec_overrides
--   FROM public.bike_components WHERE brand IS NOT NULL OR model IS NOT NULL OR mpn IS NOT NULL
--   OR attributes IS NOT NULL OR spec_overrides IS NOT NULL) TO STDOUT WITH CSV HEADER;
-- Deploy the pre-Checkpoint-1 code (fetchBikeComponents without override columns or
-- slot_categories) BEFORE running this, or the app's parts fetch will fail loudly.

BEGIN;

-- Pre-check: report any populated override/provenance values (review before committing).
SELECT count(*) AS populated_overrides FROM public.bike_components
 WHERE brand IS NOT NULL OR model IS NOT NULL OR mpn IS NOT NULL OR attributes IS NOT NULL OR spec_overrides IS NOT NULL;
SELECT count(*) AS populated_provenance FROM public.components
 WHERE source IS NOT NULL OR raw_text IS NOT NULL OR confidence IS NOT NULL;

DROP TABLE IF EXISTS public.slot_categories;

ALTER TABLE public.bike_components
  DROP COLUMN IF EXISTS brand,
  DROP COLUMN IF EXISTS model,
  DROP COLUMN IF EXISTS mpn,
  DROP COLUMN IF EXISTS attributes,
  DROP COLUMN IF EXISTS spec_overrides;

ALTER TABLE public.components
  DROP COLUMN IF EXISTS source,
  DROP COLUMN IF EXISTS raw_text,
  DROP COLUMN IF EXISTS confidence;

-- components.updated_at trigger pre-dated Checkpoint 1; left in place.

-- COMMIT;   -- run manually after reviewing the pre-check counts
ROLLBACK;
