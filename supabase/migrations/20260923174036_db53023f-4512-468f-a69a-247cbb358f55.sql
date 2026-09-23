ALTER TABLE public.ebay_listings
  ADD COLUMN IF NOT EXISTS title_override text,
  ADD COLUMN IF NOT EXISTS best_offer_enabled boolean,
  ADD COLUMN IF NOT EXISTS ad_rate numeric,
  ADD COLUMN IF NOT EXISTS ad_id text,
  ADD COLUMN IF NOT EXISTS gallery_photo_index integer,
  ADD COLUMN IF NOT EXISTS unmapped_aspects jsonb,
  ADD COLUMN IF NOT EXISTS aspect_summary jsonb;

ALTER TABLE public.listing_templates ADD COLUMN IF NOT EXISTS title_format text;

CREATE TABLE public.ebay_orders (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  order_id text NOT NULL,
  line_item_id text,
  bike_id uuid REFERENCES public.bikes(id) ON DELETE SET NULL,
  buyer_username text,
  total numeric,
  currency text,
  status text NOT NULL DEFAULT 'new',
  carrier text,
  tracking_number text,
  despatched_at timestamptz,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, order_id)
);

GRANT SELECT ON public.ebay_orders TO authenticated;
GRANT ALL ON public.ebay_orders TO service_role;
ALTER TABLE public.ebay_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business members view eBay orders" ON public.ebay_orders
  FOR SELECT TO authenticated
  USING (business_id = public.current_business_id()
         AND public.has_any_role(ARRAY['admin','owner','accountant','customer_service']::user_role[]));
CREATE POLICY "Super admins view eBay orders" ON public.ebay_orders
  FOR SELECT TO authenticated USING (public.is_super_admin());

CREATE TRIGGER update_ebay_orders_updated_at BEFORE UPDATE ON public.ebay_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();