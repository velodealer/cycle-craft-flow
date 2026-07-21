ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS vat_scheme text NOT NULL DEFAULT 'standard';
ALTER TABLE public.quote_versions ADD COLUMN IF NOT EXISTS vat_scheme text NOT NULL DEFAULT 'standard';