-- 1. Strict tenant scope on remaining tables
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['ebay_orders','build_parts','invoice_counters','squarespace_listings','inspectabike_connections','business_subscriptions'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS tenant_scope ON public.%I', t);
    EXECUTE format('CREATE POLICY tenant_scope ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (business_id = public.current_business_id() OR public.is_super_admin()) WITH CHECK (business_id = public.current_business_id() OR public.is_super_admin())', t);
  END LOOP;
END $$;

DROP POLICY IF EXISTS tenant_scope ON public.bike_activity;
CREATE POLICY tenant_scope ON public.bike_activity AS RESTRICTIVE FOR ALL TO authenticated
  USING (business_id = public.current_business_id() OR public.is_super_admin() OR public.is_investor_for_bike(bike_id))
  WITH CHECK (business_id = public.current_business_id() OR public.is_super_admin());

-- 2. Enforce business_id on insert, block changes on update
CREATE OR REPLACE FUNCTION public.set_business_id_default()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _mine uuid;
BEGIN
  IF auth.uid() IS NULL OR public.is_super_admin() THEN
    IF NEW.business_id IS NULL THEN NEW.business_id := public.current_business_id(); END IF;
    RETURN NEW;
  END IF;
  _mine := public.current_business_id();
  IF _mine IS NOT NULL THEN NEW.business_id := _mine; END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.guard_business_id_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.business_id IS DISTINCT FROM OLD.business_id
     AND auth.uid() IS NOT NULL AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Records cannot be moved between dealerships';
  END IF;
  RETURN NEW;
END $$;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT DISTINCT c.relname FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_proc p ON p.oid=t.tgfoid
           WHERE p.proname='set_business_id_default' LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS guard_business_id_change ON public.%I', r.relname);
    EXECUTE format('CREATE TRIGGER guard_business_id_change BEFORE UPDATE OF business_id ON public.%I FOR EACH ROW EXECUTE FUNCTION public.guard_business_id_change()', r.relname);
  END LOOP;
  FOREACH r.relname IN ARRAY ARRAY['ebay_orders','build_parts','squarespace_listings'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_business_id_default_trigger ON public.%I', r.relname);
    EXECUTE format('CREATE TRIGGER set_business_id_default_trigger BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_business_id_default()', r.relname);
    EXECUTE format('DROP TRIGGER IF EXISTS guard_business_id_change ON public.%I', r.relname);
    EXECUTE format('CREATE TRIGGER guard_business_id_change BEFORE UPDATE OF business_id ON public.%I FOR EACH ROW EXECUTE FUNCTION public.guard_business_id_change()', r.relname);
  END LOOP;
END $$;

-- 3. No anonymous execution of privileged functions
DO $$
DECLARE f record;
BEGIN
  FOR f IN SELECT p.oid::regprocedure AS sig FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND p.prosecdef LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', f.sig);
  END LOOP;
END $$;
GRANT EXECUTE ON FUNCTION public.current_business_id(), public.current_business_status(), public.is_super_admin(),
  public.has_role(public.user_role), public.has_any_role(public.user_role[]), public.get_current_user_role(),
  public.is_investor_for_bike(uuid), public.generate_bike_reference(text,text,uuid),
  public.admin_dealership_stats(timestamptz,timestamptz), public.admin_integration_health(), public.admin_platform_overview()
  TO authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user(), public.set_business_id_default(), public.set_bike_reference(), public.guard_business_id_change() FROM authenticated;

-- 4. Photos: only the uploading dealership may change/delete
DO $$
DECLARE b text; pol text;
BEGIN
  FOREACH b IN ARRAY ARRAY['bike','job','fulfilment'] LOOP
    FOREACH pol IN ARRAY ARRAY['update','delete'] LOOP
      EXECUTE format('DROP POLICY IF EXISTS "Own dealership %s %s photos" ON storage.objects', pol, b);
      EXECUTE format($p$CREATE POLICY "Own dealership %s %s photos" ON storage.objects AS RESTRICTIVE FOR %s TO public
        USING (bucket_id <> '%s-photos' OR public.is_super_admin() OR owner IS NULL
               OR EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.user_id = storage.objects.owner AND pr.business_id = public.current_business_id()))$p$,
        pol, b, upper(pol), b);
    END LOOP;
  END LOOP;
END $$;