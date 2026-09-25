ALTER TABLE public.integrations DROP CONSTRAINT IF EXISTS integrations_name_key;
DROP INDEX IF EXISTS public.integrations_name_key;

ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS xero_invoice_id text, ADD COLUMN IF NOT EXISTS xero_journal_id text, ADD COLUMN IF NOT EXISTS xero_sync_status text, ADD COLUMN IF NOT EXISTS xero_sync_error text;
ALTER TABLE public.bikes ADD COLUMN IF NOT EXISTS xero_purchase_journal_id text, ADD COLUMN IF NOT EXISTS xero_purchase_sync_status text, ADD COLUMN IF NOT EXISTS xero_purchase_sync_error text;

CREATE TABLE public.xero_oauth_states (
  state text PRIMARY KEY,
  business_id uuid NOT NULL,
  user_id uuid NOT NULL,
  origin text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.xero_oauth_states TO service_role;
ALTER TABLE public.xero_oauth_states ENABLE ROW LEVEL SECURITY;