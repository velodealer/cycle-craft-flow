CREATE OR REPLACE FUNCTION public.flag_shopify_manual_related()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _bike uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    _bike := OLD.bike_id;
  ELSE
    _bike := NEW.bike_id;
    IF TG_TABLE_NAME = 'ebay_listings' AND TG_OP = 'UPDATE' THEN
      IF to_jsonb(NEW)->'title_override' IS NOT DISTINCT FROM to_jsonb(OLD)->'title_override' THEN
        RETURN NEW;
      END IF;
    END IF;
  END IF;
  UPDATE public.bikes SET shopify_manual_stale = true
   WHERE id = _bike AND shopify_manual_listed_at IS NOT NULL AND NOT shopify_manual_stale;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $function$;