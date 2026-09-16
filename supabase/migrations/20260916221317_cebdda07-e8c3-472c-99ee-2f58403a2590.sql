ALTER TABLE public.ebay_listings
  ADD COLUMN IF NOT EXISTS condition text,
  ADD COLUMN IF NOT EXISTS category_id text;