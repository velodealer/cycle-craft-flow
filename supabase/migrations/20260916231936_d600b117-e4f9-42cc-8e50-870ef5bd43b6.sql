CREATE TABLE public.integration_error_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  integration text NOT NULL,
  operation text NOT NULL,
  entity_ref text,
  status integer,
  intuit_tid text,
  message text NOT NULL,
  detail jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.integration_error_log TO authenticated;
GRANT ALL ON public.integration_error_log TO service_role;

ALTER TABLE public.integration_error_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins, owners and accountants can view integration errors"
ON public.integration_error_log
FOR SELECT
TO authenticated
USING (public.has_any_role(ARRAY['admin','owner','accountant']::user_role[]));

CREATE INDEX integration_error_log_created_at_idx ON public.integration_error_log (created_at DESC);
CREATE INDEX integration_error_log_integration_idx ON public.integration_error_log (integration, created_at DESC);