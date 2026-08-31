ALTER TABLE public.bike_collections
  ADD COLUMN IF NOT EXISTS direction text NOT NULL DEFAULT 'inbound',
  ADD COLUMN IF NOT EXISTS receiver_name text,
  ADD COLUMN IF NOT EXISTS receiver_email text,
  ADD COLUMN IF NOT EXISTS receiver_phone text,
  ADD COLUMN IF NOT EXISTS receiver_street text,
  ADD COLUMN IF NOT EXISTS receiver_city text,
  ADD COLUMN IF NOT EXISTS receiver_postcode text,
  ADD COLUMN IF NOT EXISTS receiver_country text;

UPDATE public.bike_collections SET direction = 'inbound' WHERE direction IS NULL;

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS delivery_charge numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivery_charged_to_customer boolean NOT NULL DEFAULT true;

ALTER TABLE public.bikes
  ADD COLUMN IF NOT EXISTS delivery_method text;

INSERT INTO public.app_settings (key, value)
VALUES ('default_delivery_charge', '75'::jsonb)
ON CONFLICT (key) DO NOTHING;