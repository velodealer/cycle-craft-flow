CREATE TABLE public.shopify_oauth_states (state text PRIMARY KEY, shop text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.shopify_oauth_states TO service_role;
ALTER TABLE public.shopify_oauth_states ENABLE ROW LEVEL SECURITY;