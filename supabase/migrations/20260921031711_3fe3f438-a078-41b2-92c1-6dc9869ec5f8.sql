CREATE TABLE public.bike_activity (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bike_id uuid NOT NULL REFERENCES public.bikes(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  kind text NOT NULL,
  action text NOT NULL,
  summary text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_id uuid,
  actor_label text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX bike_activity_bike_created_idx ON public.bike_activity (bike_id, created_at DESC);
CREATE INDEX bike_activity_business_idx ON public.bike_activity (business_id);

GRANT SELECT, INSERT ON public.bike_activity TO authenticated;
GRANT ALL ON public.bike_activity TO service_role;

ALTER TABLE public.bike_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business members can view bike activity"
ON public.bike_activity FOR SELECT TO authenticated
USING (business_id = public.current_business_id() OR public.is_super_admin() OR public.is_investor_for_bike(bike_id));

CREATE POLICY "Business members can log bike activity"
ON public.bike_activity FOR INSERT TO authenticated
WITH CHECK (business_id = public.current_business_id());

CREATE TRIGGER bike_activity_set_business_id
BEFORE INSERT ON public.bike_activity
FOR EACH ROW EXECUTE FUNCTION public.set_business_id_default();