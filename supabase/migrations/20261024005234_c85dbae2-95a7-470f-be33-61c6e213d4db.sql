CREATE TABLE public.platform_alert_log (
  alert_key text PRIMARY KEY,
  sent_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.platform_alert_log TO service_role;
ALTER TABLE public.platform_alert_log ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.platform_alert_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  dealer_signup boolean NOT NULL DEFAULT true,
  system_errors boolean NOT NULL DEFAULT true,
  deletion_request boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.platform_alert_settings TO authenticated;
GRANT ALL ON public.platform_alert_settings TO service_role;
ALTER TABLE public.platform_alert_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Super admins manage platform alerts" ON public.platform_alert_settings
  FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
INSERT INTO public.platform_alert_settings (id) VALUES (true);

-- Existing pending dealers and old errors/requests count as already alerted.
INSERT INTO public.platform_alert_log (alert_key)
  SELECT 'dealer:' || id FROM public.businesses WHERE status = 'pending'
  UNION ALL SELECT 'deletion:' || id FROM public.data_deletion_requests
  UNION ALL SELECT 'errors:last';