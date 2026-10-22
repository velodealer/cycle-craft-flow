CREATE OR REPLACE FUNCTION public.generate_bike_reference(_make text, _serial text, _bike_id uuid, _business_id uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_prefix text; v_brand text; v_suffix text;
BEGIN
  SELECT value #>> '{}' INTO v_prefix FROM public.app_settings
   WHERE key = 'bike_reference_prefix:' || _business_id::text;
  v_prefix := UPPER(REGEXP_REPLACE(COALESCE(v_prefix, 'VD'), '[^A-Za-z0-9]', '', 'g'));
  IF v_prefix = '' THEN v_prefix := 'VD'; END IF;
  v_prefix := LEFT(v_prefix, 6);
  v_brand := RPAD(LEFT(UPPER(REGEXP_REPLACE(COALESCE(_make, ''), '[^A-Za-z]', '', 'g')), 3), 3, 'X');
  v_suffix := RIGHT(UPPER(REGEXP_REPLACE(COALESCE(NULLIF(TRIM(COALESCE(_serial, '')), ''), REPLACE(_bike_id::text, '-', '')), '[^A-Za-z0-9]', '', 'g')), 4);
  IF LENGTH(v_suffix) < 4 THEN v_suffix := LPAD(v_suffix, 4, '0'); END IF;
  RETURN v_prefix || '-' || v_brand || '-' || v_suffix;
END $$;
REVOKE EXECUTE ON FUNCTION public.generate_bike_reference(text,text,uuid,uuid) FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.generate_bike_reference(_make text, _serial text, _bike_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.generate_bike_reference(_make, _serial, _bike_id, public.current_business_id())
$$;

CREATE OR REPLACE FUNCTION public.set_bike_reference()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_base text; v_candidate text; v_n int := 1;
BEGIN
  IF NEW.reference IS NOT NULL AND NEW.reference <> '' THEN RETURN NEW; END IF;
  v_base := public.generate_bike_reference(NEW.make,
    COALESCE(NULLIF(TRIM(COALESCE(NEW.frame_number, '')), ''), NEW.serial_number),
    NEW.id, COALESCE(NEW.business_id, public.current_business_id()));
  v_candidate := v_base;
  WHILE EXISTS (SELECT 1 FROM public.bikes WHERE reference = v_candidate) LOOP
    v_n := v_n + 1; v_candidate := v_base || '-' || v_n::text;
  END LOOP;
  NEW.reference := v_candidate;
  RETURN NEW;
END $$;

-- Catalogue: read + add for everyone signed in, edit/delete super admin only
DROP POLICY IF EXISTS "Authenticated can update catalog bikes" ON public.catalog_bikes;
DROP POLICY IF EXISTS "Admins can delete catalog bikes" ON public.catalog_bikes;
CREATE POLICY "Super admin updates catalog bikes" ON public.catalog_bikes FOR UPDATE TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "Super admin deletes catalog bikes" ON public.catalog_bikes FOR DELETE TO authenticated USING (public.is_super_admin());

CREATE OR REPLACE FUNCTION public.bump_catalog_use(_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.catalog_bikes SET use_count = COALESCE(use_count, 0) + 1 WHERE id = _id AND auth.uid() IS NOT NULL;
$$;
REVOKE EXECUTE ON FUNCTION public.bump_catalog_use(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bump_catalog_use(uuid) TO authenticated;

-- Photos: no ownerless loophole; Typeform photos belong to the submission's dealership
DO $$
DECLARE b text; pol text;
BEGIN
  FOREACH b IN ARRAY ARRAY['bike','job','fulfilment'] LOOP
    FOREACH pol IN ARRAY ARRAY['update','delete'] LOOP
      EXECUTE format('DROP POLICY IF EXISTS "Own dealership %s %s photos" ON storage.objects', pol, b);
      EXECUTE format($p$CREATE POLICY "Own dealership %s %s photos" ON storage.objects AS RESTRICTIVE FOR %s TO public
        USING (bucket_id <> '%s-photos' OR public.is_super_admin()
          OR (name LIKE 'typeform/%%' AND EXISTS (SELECT 1 FROM public.typeform_submissions s
                WHERE s.response_id = split_part(storage.objects.name, '/', 2) AND s.business_id = public.current_business_id()))
          OR (owner IS NOT NULL AND EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.user_id = storage.objects.owner AND pr.business_id = public.current_business_id())))$p$,
        pol, b, upper(pol), b);
    END LOOP;
  END LOOP;
END $$;