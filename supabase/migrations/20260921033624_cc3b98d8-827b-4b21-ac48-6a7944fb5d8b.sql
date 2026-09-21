ALTER TABLE public.bikes
  ADD COLUMN IF NOT EXISTS catalog_source text,
  ADD COLUMN IF NOT EXISTS catalog_source_id text,
  ADD COLUMN IF NOT EXISTS catalog_size text,
  ADD COLUMN IF NOT EXISTS catalog_data jsonb,
  ADD COLUMN IF NOT EXISTS catalog_synced_at timestamp with time zone;

CREATE INDEX IF NOT EXISTS bikes_catalog_source_id_idx ON public.bikes (catalog_source, catalog_source_id);