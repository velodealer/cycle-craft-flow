CREATE TABLE public.system_error_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES public.businesses(id) ON DELETE SET NULL,
  user_id uuid,
  source text NOT NULL DEFAULT 'app',
  severity text NOT NULL DEFAULT 'error',
  message text NOT NULL,
  detail jsonb,
  url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.system_error_logs TO authenticated;
GRANT ALL ON public.system_error_logs TO service_role;
ALTER TABLE public.system_error_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users log their own errors" ON public.system_error_logs
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND (business_id IS NULL OR business_id = public.current_business_id()) AND length(message) <= 2000);
CREATE POLICY "Super admin reads error log" ON public.system_error_logs
  FOR SELECT TO authenticated USING (public.is_super_admin());
CREATE INDEX system_error_logs_created_idx ON public.system_error_logs (created_at DESC);
CREATE INDEX system_error_logs_business_idx ON public.system_error_logs (business_id, created_at DESC);

CREATE INDEX IF NOT EXISTS bikes_business_status_idx ON public.bikes (business_id, status);
CREATE INDEX IF NOT EXISTS bikes_business_created_idx ON public.bikes (business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS jobs_business_status_idx ON public.jobs (business_id, status);
CREATE INDEX IF NOT EXISTS invoices_business_created_idx ON public.invoices (business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS parts_business_status_idx ON public.parts (business_id, stock_status);
CREATE INDEX IF NOT EXISTS inspection_faults_business_status_idx ON public.inspection_faults (business_id, status);

DROP TABLE IF EXISTS public.components_backup_20260923;
DROP TABLE IF EXISTS public.bike_components_backup_20260923;
DROP TABLE IF EXISTS public.bikes_spec_backup_20260923;
DROP TABLE IF EXISTS public.integrations_backup_20260925;