INSERT INTO public.component_categories (slug, name, sort_order) VALUES
  ('headset', 'Headset', 25),
  ('hubs', 'Hubs', 45),
  ('spokes', 'Spokes', 46),
  ('rotors', 'Disc Rotors', 135),
  ('brake_levers', 'Brake Levers', 136),
  ('power_meter', 'Power Meter', 65),
  ('ebike_battery', 'E-bike Battery', 201),
  ('ebike_display', 'E-bike Display', 202),
  ('ebike_charger', 'E-bike Charger', 203)
ON CONFLICT (slug) DO NOTHING;