CREATE TABLE public.integrations_backup_20260925 AS SELECT * FROM public.integrations;
REVOKE ALL ON public.integrations_backup_20260925 FROM anon, authenticated;
GRANT ALL ON public.integrations_backup_20260925 TO service_role;
ALTER TABLE public.integrations_backup_20260925 ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view all integrations" ON public.integrations;
DROP POLICY IF EXISTS "Admins can insert integrations" ON public.integrations;
DROP POLICY IF EXISTS "Admins can update integrations" ON public.integrations;
DROP POLICY IF EXISTS "Admins can delete integrations" ON public.integrations;
DROP POLICY IF EXISTS tenant_scope ON public.integrations;

CREATE POLICY tenant_scope ON public.integrations FOR ALL TO authenticated
  USING (business_id = public.current_business_id() OR public.is_super_admin())
  WITH CHECK (business_id = public.current_business_id() OR public.is_super_admin());

CREATE POLICY "Only managers insert integrations" ON public.integrations AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role('{admin,owner}'::user_role[]) OR public.is_super_admin());
CREATE POLICY "Only managers update integrations" ON public.integrations AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.has_any_role('{admin,owner}'::user_role[]) OR public.is_super_admin());
CREATE POLICY "Only managers delete integrations" ON public.integrations AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.has_any_role('{admin,owner}'::user_role[]) OR public.is_super_admin());

REVOKE ALL ON public.integrations FROM anon;
REVOKE SELECT, INSERT, UPDATE ON public.integrations FROM authenticated;
GRANT SELECT (id, name, display_name, is_active, business_id, created_at, updated_at) ON public.integrations TO authenticated;
GRANT INSERT (name, display_name, is_active, settings, webhook_secret, business_id, updated_at) ON public.integrations TO authenticated;
GRANT UPDATE (display_name, is_active, settings, webhook_secret, updated_at) ON public.integrations TO authenticated;
GRANT DELETE ON public.integrations TO authenticated;
GRANT ALL ON public.integrations TO service_role;

-- Browsers may only edit settings of connections that hold no sign-in.
CREATE OR REPLACE FUNCTION public.guard_integration_settings()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user = 'authenticated'
     AND NEW.name NOT IN ('resend', 'cycle_courier_co')
     AND NEW.settings IS DISTINCT FROM OLD.settings THEN
    RAISE EXCEPTION 'Connection settings for % can only be changed through VeloDealer', NEW.name;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_integration_settings BEFORE UPDATE ON public.integrations
  FOR EACH ROW EXECUTE FUNCTION public.guard_integration_settings();

-- Cleaned settings for the caller's own dealership (no tokens or secrets).
CREATE OR REPLACE FUNCTION public.get_integration_settings(_name text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'id', i.id,
    'is_active', i.is_active,
    'has_webhook_secret', i.webhook_secret IS NOT NULL AND i.webhook_secret <> '',
    'settings', coalesce(i.settings, '{}'::jsonb)
      - 'tokens' - 'access_token' - 'refresh_token' - 'access_token_expires_at'
      - 'webhook_secret' - 'client_secret' - 'api_key'
  )
  FROM integrations i
  WHERE i.name = _name AND i.business_id = public.current_business_id()
  LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.get_integration_settings(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_integration_settings(text) TO authenticated;

REVOKE ALL ON public.inspectabike_connections FROM anon, authenticated;
GRANT ALL ON public.inspectabike_connections TO service_role;