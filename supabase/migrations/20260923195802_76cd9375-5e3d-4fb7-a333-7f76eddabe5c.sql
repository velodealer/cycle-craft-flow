REVOKE ALL ON public.slot_categories FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.slot_categories FROM authenticated;