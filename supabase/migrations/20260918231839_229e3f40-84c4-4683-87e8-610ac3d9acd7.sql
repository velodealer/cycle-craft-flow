CREATE TABLE public.inspectabike_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL UNIQUE REFERENCES public.businesses(id) ON DELETE CASCADE,
  access_token text,
  refresh_token text,
  access_token_expires_at timestamptz,
  account_name text,
  external_account_id text,
  webhook_secret text,
  status text NOT NULL DEFAULT 'connected',
  last_error text,
  connected_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.inspectabike_connections TO authenticated;
GRANT ALL ON public.inspectabike_connections TO service_role;

ALTER TABLE public.inspectabike_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view their InspectABike connection"
ON public.inspectabike_connections
FOR SELECT
TO authenticated
USING (business_id = public.current_business_id() OR public.is_super_admin());

CREATE TRIGGER update_inspectabike_connections_updated_at
BEFORE UPDATE ON public.inspectabike_connections
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.inspectabike_oauth_states (
  state text PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  code_verifier text NOT NULL,
  origin text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.inspectabike_oauth_states TO service_role;

ALTER TABLE public.inspectabike_oauth_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages InspectABike oauth states"
ON public.inspectabike_oauth_states
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);