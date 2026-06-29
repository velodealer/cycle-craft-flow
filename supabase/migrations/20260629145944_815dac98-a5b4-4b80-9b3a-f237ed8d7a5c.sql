ALTER TABLE public.bikes DROP CONSTRAINT owner_check;
ALTER TABLE public.bikes ADD CONSTRAINT owner_check CHECK (
  (owner_id IS NOT NULL AND external_owner_id IS NULL)
  OR (owner_id IS NULL AND external_owner_id IS NOT NULL)
  OR (owner_id IS NULL AND external_owner_id IS NULL AND source IN ('owned'::bike_source, 'investor'::bike_source))
);