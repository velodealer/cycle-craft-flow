-- Restore fitted parts from the 2026-09-23 backups.
-- Run in the Supabase SQL editor as the postgres role. Wrapped in a transaction:
-- check the counts at the end, then COMMIT (or ROLLBACK if anything looks wrong).
--
-- Backups: components_backup_20260923 (113 rows), bike_components_backup_20260923 (145),
--          bikes_spec_backup_20260923 (83: id, spec_values, accessories_included).
-- Note: if Checkpoint 1 columns exist, run docs/rollback-checkpoint1.sql first, or the
-- column lists below still work because they name only the original columns.

BEGIN;

-- 1. Fitted parts (children first because of the foreign key to components)
DELETE FROM public.bike_components;

-- 2. Library
DELETE FROM public.components WHERE id NOT IN (SELECT id FROM public.components_backup_20260923);
INSERT INTO public.components (id, category_id, brand, model, mpn, description, weight_g, attributes, created_at, updated_at, business_id)
SELECT id, category_id, brand, model, mpn, description, weight_g, attributes, created_at, updated_at, business_id
FROM public.components_backup_20260923
ON CONFLICT (id) DO UPDATE SET
  category_id = EXCLUDED.category_id, brand = EXCLUDED.brand, model = EXCLUDED.model,
  mpn = EXCLUDED.mpn, description = EXCLUDED.description, weight_g = EXCLUDED.weight_g,
  attributes = EXCLUDED.attributes, updated_at = EXCLUDED.updated_at, business_id = EXCLUDED.business_id;

INSERT INTO public.bike_components (id, bike_id, component_id, slot, position, notes, created_at, business_id)
SELECT id, bike_id, component_id, slot, position, notes, created_at, business_id
FROM public.bike_components_backup_20260923;

-- 3. Bike spec (bikes created after the backup are left untouched)
UPDATE public.bikes b
SET spec_values = s.spec_values, accessories_included = s.accessories_included
FROM public.bikes_spec_backup_20260923 s
WHERE s.id = b.id;

-- 4. Verify, expect 113 / 145
SELECT (SELECT count(*) FROM public.components) AS components,
       (SELECT count(*) FROM public.bike_components) AS bike_components;

-- COMMIT;   -- uncomment when the counts look right
-- ROLLBACK; -- otherwise
