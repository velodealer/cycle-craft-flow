ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS public_token text;
UPDATE public.invoices SET public_token = replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '') WHERE public_token IS NULL;
ALTER TABLE public.invoices ALTER COLUMN public_token SET DEFAULT replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
ALTER TABLE public.invoices ALTER COLUMN public_token SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS invoices_public_token_key ON public.invoices(public_token);