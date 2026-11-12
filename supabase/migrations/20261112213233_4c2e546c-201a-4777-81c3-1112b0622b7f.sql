CREATE OR REPLACE FUNCTION public.bike_reference_lock_reason(_bike_id uuid, _status text, _manual timestamptz)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN _status IN ('sold','collected','delivered') THEN 'it has already been sold'
    WHEN EXISTS (SELECT 1 FROM public.ebay_listings WHERE bike_id = _bike_id AND status = 'listed') THEN 'it is live on eBay'
    WHEN EXISTS (SELECT 1 FROM public.shopify_listings WHERE bike_id = _bike_id AND product_id IS NOT NULL
                 AND COALESCE(status,'') NOT IN ('not_listed','removed','deleted','archived')) THEN 'it is live on Shopify'
    WHEN _manual IS NOT NULL THEN 'it has been uploaded to Shopify by CSV'
    WHEN EXISTS (SELECT 1 FROM public.squarespace_listings WHERE bike_id = _bike_id AND product_id IS NOT NULL
                 AND COALESCE(status,'') NOT IN ('not_listed','removed','deleted')) THEN 'it is live on Squarespace'
  END
$$;
REVOKE EXECUTE ON FUNCTION public.bike_reference_lock_reason(uuid, text, timestamptz) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.set_bike_reference()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_base text; v_candidate text; v_n int := 1;
  v_old_serial text; v_new_serial text; v_force boolean; v_lock text;
BEGIN
  v_new_serial := COALESCE(NULLIF(TRIM(COALESCE(NEW.frame_number, '')), ''), NULLIF(TRIM(COALESCE(NEW.serial_number, '')), ''));

  IF TG_OP = 'INSERT' THEN
    IF NEW.reference IS NOT NULL AND NEW.reference <> '' THEN RETURN NEW; END IF;
  ELSE
    v_force := NEW.reference IS NULL OR NEW.reference = '';
    IF NOT v_force THEN
      v_old_serial := COALESCE(NULLIF(TRIM(COALESCE(OLD.frame_number, '')), ''), NULLIF(TRIM(COALESCE(OLD.serial_number, '')), ''));
      -- Only a newly entered or changed frame/serial number triggers an automatic update
      IF v_new_serial IS NULL OR v_new_serial IS NOT DISTINCT FROM v_old_serial THEN RETURN NEW; END IF;
      -- Respect an ID set explicitly in the same save
      IF NEW.reference IS DISTINCT FROM OLD.reference THEN RETURN NEW; END IF;
    END IF;
    v_lock := public.bike_reference_lock_reason(NEW.id, NEW.status::text, NEW.shopify_manual_listed_at);
    IF v_lock IS NOT NULL THEN
      IF v_force THEN
        RAISE EXCEPTION 'This bike ID can''t be changed because %. Take it off sale first.', v_lock USING ERRCODE = 'P0001';
      END IF;
      RETURN NEW;
    END IF;
  END IF;

  v_base := public.generate_bike_reference(NEW.make, v_new_serial,
    NEW.id, COALESCE(NEW.business_id, public.current_business_id()));

  -- Already matches (including a -N collision ending): keep it
  IF TG_OP = 'UPDATE' AND OLD.reference IS NOT NULL
     AND (OLD.reference = v_base OR OLD.reference ~ ('^' || v_base || '-[0-9]+$')) THEN
    NEW.reference := OLD.reference;
    RETURN NEW;
  END IF;

  v_candidate := v_base;
  WHILE EXISTS (SELECT 1 FROM public.bikes WHERE reference = v_candidate AND id <> NEW.id) LOOP
    v_n := v_n + 1; v_candidate := v_base || '-' || v_n::text;
  END LOOP;
  NEW.reference := v_candidate;

  IF TG_OP = 'UPDATE' AND OLD.reference IS DISTINCT FROM v_candidate THEN
    BEGIN
      PERFORM public._log_bike(NEW.id, 'detail_change', 'reference_changed',
        'Bike ID changed from ' || COALESCE(OLD.reference, '—') || ' to ' || v_candidate,
        jsonb_build_object('from', OLD.reference, 'to', v_candidate));
    EXCEPTION WHEN others THEN NULL;
    END;
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.set_bike_reference() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS set_bike_reference_trigger ON public.bikes;
CREATE TRIGGER set_bike_reference_trigger
  BEFORE INSERT OR UPDATE OF reference, frame_number, serial_number ON public.bikes
  FOR EACH ROW EXECUTE FUNCTION public.set_bike_reference();

CREATE OR REPLACE FUNCTION public.regenerate_bike_reference(_bike_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE v_ref text;
BEGIN
  UPDATE public.bikes SET reference = NULL WHERE id = _bike_id RETURNING reference INTO v_ref;
  IF NOT FOUND THEN RAISE EXCEPTION 'Bike not found or you can''t edit it.'; END IF;
  RETURN v_ref;
END $$;
REVOKE EXECUTE ON FUNCTION public.regenerate_bike_reference(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.regenerate_bike_reference(uuid) TO authenticated;