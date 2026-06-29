
-- Extend bikes
ALTER TABLE public.bikes
  ADD COLUMN IF NOT EXISTS bike_type text,
  ADD COLUMN IF NOT EXISTS gender text,
  ADD COLUMN IF NOT EXISTS weight_kg numeric,
  ADD COLUMN IF NOT EXISTS frame_material text,
  ADD COLUMN IF NOT EXISTS serial_number text,
  ADD COLUMN IF NOT EXISTS barcode text,
  ADD COLUMN IF NOT EXISTS sku text,
  ADD COLUMN IF NOT EXISTS has_rear_shock boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_electric boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_dropper boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_suspension_fork boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_accessories boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS spec_values jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Component categories
CREATE TABLE IF NOT EXISTS public.component_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.component_categories TO authenticated;
GRANT ALL ON public.component_categories TO service_role;

ALTER TABLE public.component_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Categories readable by authenticated"
  ON public.component_categories FOR SELECT TO authenticated USING (true);

-- Components library
CREATE TABLE IF NOT EXISTS public.components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.component_categories(id) ON DELETE RESTRICT,
  brand text NOT NULL,
  model text NOT NULL,
  mpn text,
  description text,
  weight_g numeric,
  attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS components_brand_model_mpn_uk
  ON public.components (brand, model, COALESCE(mpn, ''));
CREATE INDEX IF NOT EXISTS components_category_idx ON public.components (category_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.components TO authenticated;
GRANT ALL ON public.components TO service_role;

ALTER TABLE public.components ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Components readable by authenticated"
  ON public.components FOR SELECT TO authenticated USING (true);
CREATE POLICY "Components manageable by authenticated"
  ON public.components FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER update_components_updated_at
  BEFORE UPDATE ON public.components
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Bike <-> components join
CREATE TABLE IF NOT EXISTS public.bike_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bike_id uuid NOT NULL REFERENCES public.bikes(id) ON DELETE CASCADE,
  component_id uuid NOT NULL REFERENCES public.components(id) ON DELETE RESTRICT,
  slot text NOT NULL,
  position text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS bike_components_slot_uk
  ON public.bike_components (bike_id, slot);
CREATE INDEX IF NOT EXISTS bike_components_bike_idx ON public.bike_components (bike_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bike_components TO authenticated;
GRANT ALL ON public.bike_components TO service_role;

ALTER TABLE public.bike_components ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Bike components readable by authenticated"
  ON public.bike_components FOR SELECT TO authenticated USING (true);
CREATE POLICY "Bike components manageable by authenticated"
  ON public.bike_components FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Seed categories
INSERT INTO public.component_categories (slug, name, sort_order) VALUES
  ('frame', 'Frame', 10),
  ('fork', 'Fork', 20),
  ('rear_shock', 'Rear Shock', 30),
  ('wheels', 'Wheels', 40),
  ('tyres', 'Tyres', 50),
  ('crank', 'Crank', 60),
  ('cassette', 'Cassette', 70),
  ('chain', 'Chain', 80),
  ('front_derailleur', 'Front Derailleur', 90),
  ('rear_derailleur', 'Rear Derailleur', 100),
  ('shifters', 'Shifters', 110),
  ('bottom_bracket', 'Bottom Bracket', 120),
  ('brakes', 'Brakes', 130),
  ('handlebars', 'Handlebars', 140),
  ('stem', 'Stem', 150),
  ('grips', 'Grips / Bar Tape', 160),
  ('saddle', 'Saddle', 170),
  ('seatpost', 'Seatpost', 180),
  ('pedals', 'Pedals', 190),
  ('ebike_system', 'E-bike System', 200),
  ('accessories', 'Accessories', 210)
ON CONFLICT (slug) DO NOTHING;
