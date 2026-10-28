REVOKE ALL ON public.password_reset_attempts FROM anon, authenticated, PUBLIC;
REVOKE ALL ON SEQUENCE public.password_reset_attempts_id_seq FROM anon, authenticated, PUBLIC;