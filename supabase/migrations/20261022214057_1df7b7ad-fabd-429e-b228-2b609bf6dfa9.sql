DROP POLICY IF EXISTS "Super admins read sync alerts" ON public.sync_failure_alerts;
REVOKE ALL ON public.sync_failure_alerts FROM anon, authenticated;