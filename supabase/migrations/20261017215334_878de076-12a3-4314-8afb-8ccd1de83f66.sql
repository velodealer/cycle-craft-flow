CREATE OR REPLACE FUNCTION public.promote_bike_to_listed(_bike_id uuid, _channel text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _biz uuid;
BEGIN
  UPDATE public.bikes SET status = 'listed'
   WHERE id = _bike_id AND status = 'ready'
  RETURNING business_id INTO _biz;
  IF _biz IS NOT NULL THEN
    INSERT INTO public.bike_activity (bike_id, business_id, kind, action, summary, detail, actor_label)
    VALUES (_bike_id, _biz, 'status_change', 'auto_listed',
            'Stage changed from Ready for Sale to Listed (listed on ' || _channel || ')',
            jsonb_build_object('from','ready','to','listed','channel',_channel), 'System');
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.auto_list_from_channel()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'listed' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'listed') THEN
    PERFORM public.promote_bike_to_listed(NEW.bike_id, TG_ARGV[0]);
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.auto_list_from_shopify_manual()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.shopify_manual_listed_at IS NOT NULL AND OLD.shopify_manual_listed_at IS NULL AND NEW.status = 'ready' THEN
    NEW.status := 'listed';
    INSERT INTO public.bike_activity (bike_id, business_id, kind, action, summary, detail, actor_label)
    VALUES (NEW.id, NEW.business_id, 'status_change', 'auto_listed',
            'Stage changed from Ready for Sale to Listed (listed on Shopify)',
            jsonb_build_object('from','ready','to','listed','channel','Shopify'), 'System');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS auto_list_ebay ON public.ebay_listings;
CREATE TRIGGER auto_list_ebay AFTER INSERT OR UPDATE OF status ON public.ebay_listings
FOR EACH ROW EXECUTE FUNCTION public.auto_list_from_channel('eBay');
DROP TRIGGER IF EXISTS auto_list_shopify ON public.shopify_listings;
CREATE TRIGGER auto_list_shopify AFTER INSERT OR UPDATE OF status ON public.shopify_listings
FOR EACH ROW EXECUTE FUNCTION public.auto_list_from_channel('Shopify');
DROP TRIGGER IF EXISTS auto_list_squarespace ON public.squarespace_listings;
CREATE TRIGGER auto_list_squarespace AFTER INSERT OR UPDATE OF status ON public.squarespace_listings
FOR EACH ROW EXECUTE FUNCTION public.auto_list_from_channel('Squarespace');
DROP TRIGGER IF EXISTS auto_list_shopify_manual ON public.bikes;
CREATE TRIGGER auto_list_shopify_manual BEFORE UPDATE OF shopify_manual_listed_at ON public.bikes
FOR EACH ROW EXECUTE FUNCTION public.auto_list_from_shopify_manual();

REVOKE EXECUTE ON FUNCTION public.promote_bike_to_listed(uuid, text) FROM PUBLIC, anon, authenticated;