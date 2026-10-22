DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
           WHERE n.nspname='public' AND c.relkind IN ('r','v','m','f')
             AND c.relname NOT IN ('blog_posts','job_openings')
  LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', r.relname);
  END LOOP;
END $$;
REVOKE ALL ON public.blog_posts FROM anon;
GRANT SELECT ON public.blog_posts TO anon;
REVOKE ALL ON public.job_openings FROM anon;
GRANT SELECT ON public.job_openings TO anon;