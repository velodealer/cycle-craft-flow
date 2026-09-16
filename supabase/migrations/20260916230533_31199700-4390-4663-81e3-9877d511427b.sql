CREATE TABLE public.shopify_compliance_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  topic text NOT NULL,
  shop_domain text,
  payload_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  outcome text,
  handled_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.shopify_compliance_events TO authenticated;
GRANT ALL ON public.shopify_compliance_events TO service_role;

ALTER TABLE public.shopify_compliance_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and owners can view Shopify compliance events"
ON public.shopify_compliance_events
FOR SELECT
TO authenticated
USING (public.has_any_role(ARRAY['admin','owner']::user_role[]));