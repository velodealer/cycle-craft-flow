
CREATE TABLE public.quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  notes text,
  sale_price numeric NOT NULL DEFAULT 0,
  rows jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_cost numeric NOT NULL DEFAULT 0,
  current_version integer NOT NULL DEFAULT 1,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quotes TO authenticated;
GRANT ALL ON public.quotes TO service_role;

ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view quotes" ON public.quotes FOR SELECT TO authenticated
USING (public.has_any_role(ARRAY['admin','mechanic','accountant','owner']::user_role[]));

CREATE POLICY "Staff can create quotes" ON public.quotes FOR INSERT TO authenticated
WITH CHECK (
  public.has_any_role(ARRAY['admin','mechanic','accountant','owner']::user_role[])
  AND created_by = auth.uid()
);

CREATE POLICY "Author or admin can update quotes" ON public.quotes FOR UPDATE TO authenticated
USING (created_by = auth.uid() OR public.has_role('admin'::user_role))
WITH CHECK (created_by = auth.uid() OR public.has_role('admin'::user_role));

CREATE POLICY "Author or admin can delete quotes" ON public.quotes FOR DELETE TO authenticated
USING (created_by = auth.uid() OR public.has_role('admin'::user_role));

CREATE TRIGGER update_quotes_updated_at
BEFORE UPDATE ON public.quotes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.quote_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  version integer NOT NULL,
  name text NOT NULL,
  notes text,
  sale_price numeric NOT NULL DEFAULT 0,
  rows jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_cost numeric NOT NULL DEFAULT 0,
  saved_by uuid,
  saved_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (quote_id, version)
);

CREATE INDEX idx_quote_versions_quote ON public.quote_versions(quote_id, version DESC);

GRANT SELECT, INSERT ON public.quote_versions TO authenticated;
GRANT ALL ON public.quote_versions TO service_role;

ALTER TABLE public.quote_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view quote versions" ON public.quote_versions FOR SELECT TO authenticated
USING (public.has_any_role(ARRAY['admin','mechanic','accountant','owner']::user_role[]));

CREATE POLICY "Staff can create quote versions" ON public.quote_versions FOR INSERT TO authenticated
WITH CHECK (
  public.has_any_role(ARRAY['admin','mechanic','accountant','owner']::user_role[])
  AND saved_by = auth.uid()
);
