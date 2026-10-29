ALTER TYPE public.bike_status ADD VALUE IF NOT EXISTS 'photos' AFTER 'repair';

CREATE TABLE public.bike_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bike_id uuid NOT NULL REFERENCES public.bikes(id) ON DELETE CASCADE,
  business_id uuid REFERENCES public.businesses(id),
  shot_id text NOT NULL,
  shot_number int NOT NULL,
  status text NOT NULL,
  skip_reason text,
  storage_path text,
  width int,
  height int,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bike_id, shot_id),
  CONSTRAINT bike_photos_status_chk CHECK (status IN ('captured','skipped'))
);
CREATE INDEX bike_photos_business_idx ON public.bike_photos(business_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bike_photos TO authenticated;
GRANT ALL ON public.bike_photos TO service_role;
ALTER TABLE public.bike_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage bike photos" ON public.bike_photos FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.bikes b WHERE b.id = bike_id))
  WITH CHECK (EXISTS (SELECT 1 FROM public.bikes b WHERE b.id = bike_id));
CREATE POLICY tenant_scope ON public.bike_photos AS RESTRICTIVE FOR ALL TO authenticated
  USING ((business_id = (SELECT public.current_business_id())) AND ((SELECT public.is_super_admin()) OR ((SELECT public.current_business_status()) = 'active')))
  WITH CHECK ((business_id = (SELECT public.current_business_id())) AND ((SELECT public.is_super_admin()) OR ((SELECT public.current_business_status()) = 'active')));

CREATE TRIGGER set_business_id_default_trigger BEFORE INSERT ON public.bike_photos FOR EACH ROW EXECUTE FUNCTION public.set_business_id_default();
CREATE TRIGGER guard_business_id_change BEFORE UPDATE OF business_id ON public.bike_photos FOR EACH ROW EXECUTE FUNCTION public.guard_business_id_change();
CREATE TRIGGER update_bike_photos_updated_at BEFORE UPDATE ON public.bike_photos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Dealership uploads guided bike photos" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'bike-photos' AND split_part(name, '/', 1) = (SELECT public.current_business_id())::text);