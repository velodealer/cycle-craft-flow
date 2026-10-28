CREATE TABLE public.password_reset_attempts (
  id bigserial PRIMARY KEY,
  email_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.password_reset_attempts TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.password_reset_attempts_id_seq TO service_role;
ALTER TABLE public.password_reset_attempts ENABLE ROW LEVEL SECURITY;
CREATE INDEX password_reset_attempts_email_time ON public.password_reset_attempts (email_hash, created_at);