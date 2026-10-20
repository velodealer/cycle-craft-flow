ALTER TABLE public.quotes
  ADD COLUMN build_status text NOT NULL DEFAULT 'quote',
  ADD COLUMN bike_id uuid REFERENCES public.bikes(id) ON DELETE SET NULL,
  ADD COLUMN customer_name text,
  ADD COLUMN customer_email text,
  ADD COLUMN accepted_at timestamptz;

CREATE TABLE public.build_parts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL DEFAULT public.current_business_id(),
  quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  description text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'Other',
  qty numeric NOT NULL DEFAULT 1,
  unit_cost numeric NOT NULL DEFAULT 0,
  source text NOT NULL DEFAULT 'order',
  status text NOT NULL DEFAULT 'to_order',
  supplier text,
  order_ref text,
  ordered_at timestamptz,
  received_at timestamptz,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.build_parts TO authenticated;
GRANT ALL ON public.build_parts TO service_role;
ALTER TABLE public.build_parts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage build parts" ON public.build_parts FOR ALL TO authenticated
  USING (business_id = public.current_business_id() AND public.has_any_role(ARRAY['admin','mechanic','accountant','owner']::user_role[]))
  WITH CHECK (business_id = public.current_business_id() AND public.has_any_role(ARRAY['admin','mechanic','accountant','owner']::user_role[]));
CREATE TRIGGER update_build_parts_updated_at BEFORE UPDATE ON public.build_parts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();