ALTER TABLE public.bikes
  ADD COLUMN IF NOT EXISTS shopify_manual_listed_at timestamptz,
  ADD COLUMN IF NOT EXISTS shopify_manual_listed_by uuid,
  ADD COLUMN IF NOT EXISTS shopify_manual_stale boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS shopify_delist_required_at timestamptz;

CREATE OR REPLACE FUNCTION public.flag_shopify_manual_changes()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.shopify_manual_listed_at IS NOT NULL
     AND NEW.shopify_manual_listed_at IS NOT DISTINCT FROM OLD.shopify_manual_listed_at
     AND (
       NEW.make IS DISTINCT FROM OLD.make OR NEW.model IS DISTINCT FROM OLD.model OR NEW.year IS DISTINCT FROM OLD.year
       OR NEW.asking_price IS DISTINCT FROM OLD.asking_price OR NEW.description IS DISTINCT FROM OLD.description
       OR NEW.listing_description IS DISTINCT FROM OLD.listing_description OR NEW.condition IS DISTINCT FROM OLD.condition
       OR NEW.condition_notes IS DISTINCT FROM OLD.condition_notes OR NEW.size IS DISTINCT FROM OLD.size
       OR NEW.colour IS DISTINCT FROM OLD.colour OR NEW.frame_material IS DISTINCT FROM OLD.frame_material
       OR NEW.bike_type IS DISTINCT FROM OLD.bike_type OR NEW.spec_values IS DISTINCT FROM OLD.spec_values
       OR NEW.listing_photos IS DISTINCT FROM OLD.listing_photos
     ) THEN
    NEW.shopify_manual_stale := true;
  END IF;
  IF NEW.shopify_manual_listed_at IS NOT NULL
     AND NEW.status::text IN ('sold','collected','delivered')
     AND OLD.status::text NOT IN ('sold','collected','delivered')
     AND NEW.shopify_delist_required_at IS NULL THEN
    NEW.shopify_delist_required_at := now();
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_flag_shopify_manual_changes ON public.bikes;
CREATE TRIGGER trg_flag_shopify_manual_changes BEFORE UPDATE ON public.bikes
FOR EACH ROW EXECUTE FUNCTION public.flag_shopify_manual_changes();

CREATE OR REPLACE FUNCTION public.flag_shopify_manual_related()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _bike uuid;
BEGIN
  _bike := COALESCE(NEW.bike_id, OLD.bike_id);
  IF TG_TABLE_NAME = 'ebay_listings' AND TG_OP = 'UPDATE'
     AND NEW.title_override IS NOT DISTINCT FROM OLD.title_override THEN
    RETURN NEW;
  END IF;
  UPDATE public.bikes SET shopify_manual_stale = true
   WHERE id = _bike AND shopify_manual_listed_at IS NOT NULL AND NOT shopify_manual_stale;
  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS trg_shopify_manual_components ON public.bike_components;
CREATE TRIGGER trg_shopify_manual_components AFTER INSERT OR UPDATE OR DELETE ON public.bike_components
FOR EACH ROW EXECUTE FUNCTION public.flag_shopify_manual_related();

DROP TRIGGER IF EXISTS trg_shopify_manual_title ON public.ebay_listings;
CREATE TRIGGER trg_shopify_manual_title AFTER INSERT OR UPDATE ON public.ebay_listings
FOR EACH ROW EXECUTE FUNCTION public.flag_shopify_manual_related();