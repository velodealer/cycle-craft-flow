CREATE TABLE public.ebay_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bike_id uuid NOT NULL UNIQUE REFERENCES public.bikes(id) ON DELETE CASCADE,
  environment text NOT NULL DEFAULT 'sandbox',
  sku text,
  offer_id text,
  listing_id text,
  listing_url text,
  status text NOT NULL DEFAULT 'not_listed',
  quantity integer NOT NULL DEFAULT 0,
  last_synced_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ebay_listings TO authenticated;
GRANT ALL ON public.ebay_listings TO service_role;

ALTER TABLE public.ebay_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view ebay listings" ON public.ebay_listings FOR SELECT TO authenticated
USING (has_any_role(ARRAY['admin'::user_role,'owner'::user_role,'mechanic'::user_role,'detailer'::user_role,'accountant'::user_role,'social_manager'::user_role]));

CREATE POLICY "Staff can insert ebay listings" ON public.ebay_listings FOR INSERT TO authenticated
WITH CHECK (has_any_role(ARRAY['admin'::user_role,'owner'::user_role,'mechanic'::user_role,'detailer'::user_role,'accountant'::user_role,'social_manager'::user_role]));

CREATE POLICY "Staff can update ebay listings" ON public.ebay_listings FOR UPDATE TO authenticated
USING (has_any_role(ARRAY['admin'::user_role,'owner'::user_role,'mechanic'::user_role,'detailer'::user_role,'accountant'::user_role,'social_manager'::user_role]));

CREATE POLICY "Admins can delete ebay listings" ON public.ebay_listings FOR DELETE TO authenticated
USING (has_any_role(ARRAY['admin'::user_role,'owner'::user_role]));

CREATE TRIGGER update_ebay_listings_updated_at BEFORE UPDATE ON public.ebay_listings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();