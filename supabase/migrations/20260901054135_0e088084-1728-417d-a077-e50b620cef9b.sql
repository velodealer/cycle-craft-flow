CREATE TABLE public.catalog_bikes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL DEFAULT '99spokes',
  source_id text NOT NULL,
  brand text NOT NULL,
  model text NOT NULL,
  family text,
  year integer,
  category text,
  subcategory text,
  bike_type text,
  is_ebike boolean NOT NULL DEFAULT false,
  thumbnail_url text,
  url text,
  sizes jsonb NOT NULL DEFAULT '[]'::jsonb,
  spec jsonb NOT NULL DEFAULT '{}'::jsonb,
  bike_fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  components jsonb NOT NULL DEFAULT '{}'::jsonb,
  raw jsonb,
  use_count integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source, source_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.catalog_bikes TO authenticated;
GRANT ALL ON public.catalog_bikes TO service_role;

ALTER TABLE public.catalog_bikes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read catalog bikes"
  ON public.catalog_bikes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can save catalog bikes"
  ON public.catalog_bikes FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can update catalog bikes"
  ON public.catalog_bikes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Admins can delete catalog bikes"
  ON public.catalog_bikes FOR DELETE TO authenticated USING (public.has_role('admin'::user_role));

CREATE INDEX idx_catalog_bikes_brand_model ON public.catalog_bikes (lower(brand), lower(model));
CREATE INDEX idx_catalog_bikes_year ON public.catalog_bikes (year DESC);

CREATE TRIGGER update_catalog_bikes_updated_at
  BEFORE UPDATE ON public.catalog_bikes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();