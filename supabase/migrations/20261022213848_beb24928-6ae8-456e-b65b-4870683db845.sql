CREATE TABLE public.sync_failure_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  alert_key text NOT NULL,
  first_alerted_at timestamptz NOT NULL DEFAULT now(),
  last_reminded_at timestamptz,
  UNIQUE (business_id, alert_key)
);
GRANT ALL ON public.sync_failure_alerts TO service_role;
ALTER TABLE public.sync_failure_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Super admins read sync alerts" ON public.sync_failure_alerts FOR SELECT TO authenticated USING (public.is_super_admin());