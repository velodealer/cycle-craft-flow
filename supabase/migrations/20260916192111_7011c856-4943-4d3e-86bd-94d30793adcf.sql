CREATE TABLE public.shopify_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bike_id uuid NOT NULL UNIQUE REFERENCES public.bikes(id) ON DELETE CASCADE,
  shop_domain text,
  product_id text,
  variant_id text,
  inventory_item_id text,
  location_id text,
  product_url text,
  status text NOT NULL DEFAULT 'not_listed',
  quantity integer NOT NULL DEFAULT 0,
  last_synced_at timestamp with time zone,
  last_error text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shopify_listings TO authenticated;
GRANT ALL ON public.shopify_listings TO service_role;

ALTER TABLE public.shopify_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view shopify listings"
ON public.shopify_listings FOR SELECT TO authenticated
USING (public.has_any_role(ARRAY['admin','owner','mechanic','detailer','accountant','social_manager']::user_role[]));

CREATE POLICY "Staff can insert shopify listings"
ON public.shopify_listings FOR INSERT TO authenticated
WITH CHECK (public.has_any_role(ARRAY['admin','owner','mechanic','detailer','accountant','social_manager']::user_role[]));

CREATE POLICY "Staff can update shopify listings"
ON public.shopify_listings FOR UPDATE TO authenticated
USING (public.has_any_role(ARRAY['admin','owner','mechanic','detailer','accountant','social_manager']::user_role[]));

CREATE POLICY "Admins can delete shopify listings"
ON public.shopify_listings FOR DELETE TO authenticated
USING (public.has_any_role(ARRAY['admin','owner']::user_role[]));

CREATE INDEX idx_shopify_listings_status ON public.shopify_listings(status);
CREATE INDEX idx_shopify_listings_product ON public.shopify_listings(product_id);

CREATE TRIGGER update_shopify_listings_updated_at
BEFORE UPDATE ON public.shopify_listings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();