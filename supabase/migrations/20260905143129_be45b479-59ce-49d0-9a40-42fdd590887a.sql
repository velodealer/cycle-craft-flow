CREATE TABLE public.sale_drafts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bike_id uuid NOT NULL UNIQUE REFERENCES public.bikes(id) ON DELETE CASCADE,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sale_drafts TO authenticated;
GRANT ALL ON public.sale_drafts TO service_role;

ALTER TABLE public.sale_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view sale drafts" ON public.sale_drafts
FOR SELECT TO authenticated
USING (public.has_any_role(ARRAY['admin','owner','mechanic','accountant']::user_role[]));

CREATE POLICY "Staff can create sale drafts" ON public.sale_drafts
FOR INSERT TO authenticated
WITH CHECK (public.has_any_role(ARRAY['admin','owner','mechanic','accountant']::user_role[]));

CREATE POLICY "Staff can update sale drafts" ON public.sale_drafts
FOR UPDATE TO authenticated
USING (public.has_any_role(ARRAY['admin','owner','mechanic','accountant']::user_role[]))
WITH CHECK (public.has_any_role(ARRAY['admin','owner','mechanic','accountant']::user_role[]));

CREATE POLICY "Staff can delete sale drafts" ON public.sale_drafts
FOR DELETE TO authenticated
USING (public.has_any_role(ARRAY['admin','owner','mechanic','accountant']::user_role[]));

CREATE TRIGGER update_sale_drafts_updated_at
BEFORE UPDATE ON public.sale_drafts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();