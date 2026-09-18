CREATE TABLE public.cycle_courier_connections (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL UNIQUE DEFAULT public.current_business_id() REFERENCES public.businesses(id) ON DELETE CASCADE,
  access_token text,
  refresh_token text,
  access_token_expires_at timestamptz,
  account_name text,
  status text NOT NULL DEFAULT 'connected',
  last_error text,
  connected_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.cycle_courier_connections TO service_role;

ALTER TABLE public.cycle_courier_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages cycle courier connections"
ON public.cycle_courier_connections FOR ALL TO service_role
USING (true) WITH CHECK (true);

CREATE TRIGGER update_cycle_courier_connections_updated_at
BEFORE UPDATE ON public.cycle_courier_connections
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.cycle_courier_oauth_states (
  state text NOT NULL PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  code_verifier text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.cycle_courier_oauth_states TO service_role;

ALTER TABLE public.cycle_courier_oauth_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages cycle courier oauth states"
ON public.cycle_courier_oauth_states FOR ALL TO service_role
USING (true) WITH CHECK (true);