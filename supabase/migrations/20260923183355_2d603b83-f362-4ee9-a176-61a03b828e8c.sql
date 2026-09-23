CREATE TABLE public.squarespace_oauth_states (
  state text PRIMARY KEY,
  business_id uuid NOT NULL,
  user_id uuid NOT NULL,
  return_origin text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.squarespace_oauth_states TO service_role;
ALTER TABLE public.squarespace_oauth_states ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.squarespace_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bike_id uuid NOT NULL UNIQUE REFERENCES public.bikes(id) ON DELETE CASCADE,
  business_id uuid NOT NULL,
  website_id text,
  product_id text,
  variant_id text,
  url text,
  status text NOT NULL DEFAULT 'listed',
  last_synced_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.squarespace_listings TO authenticated;
GRANT ALL ON public.squarespace_listings TO service_role;
ALTER TABLE public.squarespace_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business members read squarespace listings"
ON public.squarespace_listings FOR SELECT TO authenticated
USING (business_id = public.current_business_id() OR public.is_super_admin());

CREATE INDEX squarespace_listings_business_idx ON public.squarespace_listings(business_id);