ALTER TABLE public.inspections
  ADD COLUMN IF NOT EXISTS external_inspection_id text,
  ADD COLUMN IF NOT EXISTS external_reference text,
  ADD COLUMN IF NOT EXISTS overall_grade numeric,
  ADD COLUMN IF NOT EXISTS inspector_name text,
  ADD COLUMN IF NOT EXISTS stolen_status text,
  ADD COLUMN IF NOT EXISTS synced_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS inspections_external_inspection_id_key
  ON public.inspections (external_inspection_id)
  WHERE external_inspection_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.inspection_faults (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id uuid NOT NULL REFERENCES public.inspections(id) ON DELETE CASCADE,
  bike_id uuid NOT NULL REFERENCES public.bikes(id) ON DELETE CASCADE,
  external_fault_id text NOT NULL UNIQUE,
  title text NOT NULL DEFAULT 'Fault',
  description text,
  component text,
  severity text,
  parts_cost numeric NOT NULL DEFAULT 0,
  labour_cost numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'reported',
  decision_note text,
  decided_by uuid,
  decided_at timestamptz,
  part_id uuid REFERENCES public.parts(id) ON DELETE SET NULL,
  job_id uuid REFERENCES public.jobs(id) ON DELETE SET NULL,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inspection_faults TO authenticated;
GRANT ALL ON public.inspection_faults TO service_role;

ALTER TABLE public.inspection_faults ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view inspection faults"
ON public.inspection_faults FOR SELECT TO authenticated
USING (public.has_any_role(ARRAY['admin','owner','mechanic','detailer','accountant']::user_role[]));

CREATE POLICY "Admins can insert inspection faults"
ON public.inspection_faults FOR INSERT TO authenticated
WITH CHECK (public.has_any_role(ARRAY['admin','owner']::user_role[]));

CREATE POLICY "Admins can update inspection faults"
ON public.inspection_faults FOR UPDATE TO authenticated
USING (public.has_any_role(ARRAY['admin','owner']::user_role[]))
WITH CHECK (public.has_any_role(ARRAY['admin','owner']::user_role[]));

CREATE POLICY "Admins can delete inspection faults"
ON public.inspection_faults FOR DELETE TO authenticated
USING (public.has_any_role(ARRAY['admin','owner']::user_role[]));

CREATE INDEX IF NOT EXISTS inspection_faults_bike_id_idx ON public.inspection_faults (bike_id);
CREATE INDEX IF NOT EXISTS inspection_faults_inspection_id_idx ON public.inspection_faults (inspection_id);

CREATE TRIGGER update_inspection_faults_updated_at
BEFORE UPDATE ON public.inspection_faults
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();