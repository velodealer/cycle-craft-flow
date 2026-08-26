CREATE TABLE public.storage_bays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  zone text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX storage_bays_name_uk ON public.storage_bays (lower(name));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.storage_bays TO authenticated;
GRANT ALL ON public.storage_bays TO service_role;

ALTER TABLE public.storage_bays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view storage bays"
ON public.storage_bays FOR SELECT TO authenticated
USING (public.has_any_role(ARRAY['admin','mechanic','detailer','accountant','owner','social_manager']::user_role[]));

CREATE POLICY "Admins can insert storage bays"
ON public.storage_bays FOR INSERT TO authenticated
WITH CHECK (public.has_role('admin'::user_role));

CREATE POLICY "Admins can update storage bays"
ON public.storage_bays FOR UPDATE TO authenticated
USING (public.has_role('admin'::user_role))
WITH CHECK (public.has_role('admin'::user_role));

CREATE POLICY "Admins can delete storage bays"
ON public.storage_bays FOR DELETE TO authenticated
USING (public.has_role('admin'::user_role));

CREATE TRIGGER update_storage_bays_updated_at
BEFORE UPDATE ON public.storage_bays
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.bikes
ADD COLUMN storage_bay_id uuid REFERENCES public.storage_bays(id) ON DELETE SET NULL;

CREATE INDEX bikes_storage_bay_id_idx ON public.bikes(storage_bay_id);