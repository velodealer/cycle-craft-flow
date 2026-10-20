ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS deposit_received_at timestamptz, ADD COLUMN IF NOT EXISTS deposit_amount numeric;

CREATE OR REPLACE FUNCTION public.flag_shopify_manual_changes()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
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
  -- Sold elsewhere (eBay/Shopify/Squarespace orders) has no VeloDealer invoice
  -- gate: those channels set the delist flag themselves.
  RETURN NEW;
END $function$;

-- A bike comes off sale only once its invoice has a deposit or full payment.
CREATE OR REPLACE FUNCTION public.flag_delist_on_invoice_payment()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.bike_id IS NOT NULL AND NEW.type = 'sale'
     AND ((NEW.deposit_received_at IS NOT NULL AND OLD.deposit_received_at IS NULL)
       OR (NEW.paid_at IS NOT NULL AND OLD.paid_at IS NULL)
       OR (NEW.status = 'paid' AND OLD.status IS DISTINCT FROM 'paid')) THEN
    UPDATE public.bikes SET shopify_delist_required_at = now()
     WHERE id = NEW.bike_id AND shopify_manual_listed_at IS NOT NULL AND shopify_delist_required_at IS NULL;
  END IF;
  RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS invoices_flag_delist ON public.invoices;
CREATE TRIGGER invoices_flag_delist AFTER UPDATE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.flag_delist_on_invoice_payment();