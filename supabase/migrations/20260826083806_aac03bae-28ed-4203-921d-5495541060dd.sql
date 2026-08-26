CREATE TABLE public.inspections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bike_id uuid NOT NULL REFERENCES public.bikes(id) ON DELETE CASCADE,
  report_url text,
  notes text,
  has_issues boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'in_progress',
  inspected_by uuid REFERENCES public.profiles(id),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX inspections_bike_id_idx ON public.inspections(bike_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inspections TO authenticated;
GRANT ALL ON public.inspections TO service_role;

ALTER TABLE public.inspections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view inspections"
ON public.inspections FOR SELECT TO authenticated
USING (public.has_any_role(ARRAY['admin','mechanic','detailer','accountant','owner']::user_role[]));

CREATE POLICY "Admins and mechanics can create inspections"
ON public.inspections FOR INSERT TO authenticated
WITH CHECK (public.has_any_role(ARRAY['admin','mechanic']::user_role[]));

CREATE POLICY "Admins and mechanics can update inspections"
ON public.inspections FOR UPDATE TO authenticated
USING (public.has_any_role(ARRAY['admin','mechanic']::user_role[]))
WITH CHECK (public.has_any_role(ARRAY['admin','mechanic']::user_role[]));

CREATE POLICY "Admins can delete inspections"
ON public.inspections FOR DELETE TO authenticated
USING (public.has_role('admin'::user_role));

CREATE TRIGGER update_inspections_updated_at
BEFORE UPDATE ON public.inspections
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();