CREATE TABLE public.typeform_forms (
  id uuid primary key default gen_random_uuid(),
  form_id text not null unique,
  title text not null,
  enabled boolean not null default false,
  webhook_tag text not null default 'velodealer',
  field_map jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

CREATE TABLE public.typeform_submissions (
  id uuid primary key default gen_random_uuid(),
  form_id text not null,
  response_id text not null unique,
  submitted_at timestamptz not null default now(),
  raw_payload jsonb not null,
  submission_type text,
  customer_name text,
  customer_email text,
  customer_phone text,
  postcode text,
  bike_make text,
  bike_model text,
  bike_year integer,
  frame_number text,
  asking_price numeric,
  photo_urls text[] not null default '{}',
  status text not null default 'new',
  bike_id uuid references public.bikes(id) on delete set null,
  reviewed_by uuid references public.profiles(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

CREATE INDEX idx_typeform_submissions_status ON public.typeform_submissions (status, submitted_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.typeform_forms TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.typeform_submissions TO authenticated;
GRANT ALL ON public.typeform_forms TO service_role;
GRANT ALL ON public.typeform_submissions TO service_role;

ALTER TABLE public.typeform_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.typeform_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read forms" ON public.typeform_forms FOR SELECT TO authenticated
  USING (public.has_any_role(ARRAY['admin','owner','accountant','mechanic','detailer','social_manager']::user_role[]));
CREATE POLICY "Admin and owner can manage forms" ON public.typeform_forms FOR ALL TO authenticated
  USING (public.has_any_role(ARRAY['admin','owner']::user_role[]))
  WITH CHECK (public.has_any_role(ARRAY['admin','owner']::user_role[]));

CREATE POLICY "Staff can read submissions" ON public.typeform_submissions FOR SELECT TO authenticated
  USING (public.has_any_role(ARRAY['admin','owner','accountant','mechanic','detailer','social_manager']::user_role[]));
CREATE POLICY "Staff can update submissions" ON public.typeform_submissions FOR UPDATE TO authenticated
  USING (public.has_any_role(ARRAY['admin','owner','accountant','mechanic','detailer']::user_role[]));
CREATE POLICY "Admin and owner can delete submissions" ON public.typeform_submissions FOR DELETE TO authenticated
  USING (public.has_any_role(ARRAY['admin','owner']::user_role[]));

CREATE TRIGGER update_typeform_forms_updated_at BEFORE UPDATE ON public.typeform_forms
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_typeform_submissions_updated_at BEFORE UPDATE ON public.typeform_submissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();