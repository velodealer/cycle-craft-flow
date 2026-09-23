CREATE TABLE public.ebay_category_cache (
  marketplace_id text NOT NULL,
  category_id text NOT NULL,
  kind text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (marketplace_id, category_id, kind)
);
GRANT ALL ON public.ebay_category_cache TO service_role;
ALTER TABLE public.ebay_category_cache ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.ebay_listings
  ADD COLUMN IF NOT EXISTS condition_substituted_from text,
  ADD COLUMN IF NOT EXISTS condition_substituted_to text;

ALTER TABLE public.bikes ADD COLUMN IF NOT EXISTS mpn text;