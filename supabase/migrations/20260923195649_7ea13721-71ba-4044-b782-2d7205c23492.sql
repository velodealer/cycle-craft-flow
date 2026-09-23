-- Checkpoint 1: additive, reversible. No RLS changes on existing tables, no unique-key changes, no data writes to existing rows.

-- 1. Per-bike override columns on fitted parts (null = use the library value)
ALTER TABLE public.bike_components
  ADD COLUMN IF NOT EXISTS brand text,
  ADD COLUMN IF NOT EXISTS model text,
  ADD COLUMN IF NOT EXISTS mpn text,
  ADD COLUMN IF NOT EXISTS attributes jsonb,
  ADD COLUMN IF NOT EXISTS spec_overrides jsonb;

-- 2. Provenance columns on the component library
ALTER TABLE public.components
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS raw_text text,
  ADD COLUMN IF NOT EXISTS confidence numeric;

-- 3. Slot -> category mapping (reference data, mirrors src/lib/bikeSpec.ts)
CREATE TABLE IF NOT EXISTS public.slot_categories (
  slot text PRIMARY KEY,
  category_slug text NOT NULL,
  position text,
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0
);

GRANT SELECT ON public.slot_categories TO authenticated;
GRANT ALL ON public.slot_categories TO service_role;

ALTER TABLE public.slot_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed-in users can read slot categories"
  ON public.slot_categories FOR SELECT TO authenticated USING (true);

INSERT INTO public.slot_categories (slot, category_slug, position, label, sort_order) VALUES
  ('frame','frame',NULL,'Frame',10),
  ('headset','headset',NULL,'Headset',20),
  ('fork','fork',NULL,'Fork',30),
  ('rear_shock','rear_shock',NULL,'Rear Shock',40),
  ('wheelset','wheels',NULL,'Wheelset',50),
  ('front_hub','hubs','front','Front Hub',60),
  ('rear_hub','hubs','rear','Rear Hub',70),
  ('spokes','spokes',NULL,'Spokes',80),
  ('front_tyre','tyres','front','Front Tyre',90),
  ('rear_tyre','tyres','rear','Rear Tyre',100),
  ('crank','crank',NULL,'Crank',110),
  ('cassette','cassette',NULL,'Cassette',120),
  ('chain','chain',NULL,'Chain',130),
  ('front_derailleur','front_derailleur',NULL,'Front Derailleur',140),
  ('rear_derailleur','rear_derailleur',NULL,'Rear Derailleur',150),
  ('shifters','shifters',NULL,'Shifters',160),
  ('bottom_bracket','bottom_bracket',NULL,'Bottom Bracket',170),
  ('power_meter','power_meter',NULL,'Power Meter',180),
  ('brakes','brakes',NULL,'Brakes',190),
  ('brake_levers','brake_levers',NULL,'Brake Levers',200),
  ('disc_rotors','rotors',NULL,'Disc Rotors',210),
  ('handlebars','handlebars',NULL,'Handlebars',220),
  ('stem','stem',NULL,'Stem',230),
  ('grips','grips',NULL,'Grips / Bar Tape',240),
  ('saddle','saddle',NULL,'Saddle',250),
  ('seatpost','seatpost',NULL,'Seatpost',260),
  ('pedals','pedals',NULL,'Pedals',270),
  ('ebike_system','ebike_system',NULL,'Motor / System',280),
  ('ebike_battery','ebike_battery',NULL,'Battery',290),
  ('ebike_display','ebike_display',NULL,'Display',300),
  ('ebike_charger','ebike_charger',NULL,'Charger',310),
  ('mudguards','accessories',NULL,'Mudguards',320),
  ('rack','accessories',NULL,'Rack',330),
  ('lights','accessories',NULL,'Lights',340),
  ('bell','accessories',NULL,'Bell',350),
  ('kickstand','accessories',NULL,'Kickstand',360),
  ('lock','accessories',NULL,'Lock',370)
ON CONFLICT (slot) DO NOTHING;

-- 4. components.updated_at trigger already exists (update_components_updated_at); nothing to add.