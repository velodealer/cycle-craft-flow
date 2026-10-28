-- lovable-cron-fallback-reviewed: existing 5-minute eBay order sync kept at the same cadence; only adds a private caller token
CREATE TABLE public.scheduler_token (id int PRIMARY KEY DEFAULT 1 CHECK (id = 1), token text NOT NULL);
GRANT ALL ON public.scheduler_token TO service_role;
REVOKE ALL ON public.scheduler_token FROM anon, authenticated;
ALTER TABLE public.scheduler_token ENABLE ROW LEVEL SECURITY;
INSERT INTO public.scheduler_token (id, token) VALUES (1, encode(extensions.gen_random_bytes(32), 'hex'));

DO $$
DECLARE anon text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhnenRjeW1zY2d5dWVrZ3N5eWZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2NzMzOTUsImV4cCI6MjA3MzI0OTM5NX0.azFxlBJhK02umfWuYxWyh9ZlIzRhVEqOV5Fk3jUZtPk';
BEGIN
  PERFORM cron.schedule('ebay-order-sync', '*/5 * * * *', format($c$select net.http_post(url:='https://hgztcymscgyuekgsyyfe.supabase.co/functions/v1/ebay-order-sync', headers:=jsonb_build_object('Content-Type','application/json','apikey',%L,'x-cron-token',(select token from public.scheduler_token where id=1)), body:='{}'::jsonb);$c$, anon));
  PERFORM cron.schedule('sync-failure-alerts-hourly', '0 * * * *', format($c$select net.http_post(url:='https://api.velodealer.com/functions/v1/sync-failure-alerts', headers:=jsonb_build_object('Content-Type','application/json','apikey',%L,'x-cron-token',(select token from public.scheduler_token where id=1)), body:='{}'::jsonb);$c$, anon));
END $$;