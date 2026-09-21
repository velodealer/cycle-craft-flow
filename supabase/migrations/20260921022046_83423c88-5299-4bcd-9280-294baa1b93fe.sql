CREATE TABLE public.ebay_oauth_states (
  state text PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  environment text NOT NULL DEFAULT 'sandbox',
  origin text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT ALL ON public.ebay_oauth_states TO service_role;

ALTER TABLE public.ebay_oauth_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only"
  ON public.ebay_oauth_states
  FOR ALL
  USING (false)
  WITH CHECK (false);

CREATE UNIQUE INDEX integrations_name_business_unique
  ON public.integrations (name, business_id)
  WHERE business_id IS NOT NULL;