ALTER TABLE public.bikes
  ADD COLUMN IF NOT EXISTS sold_at timestamptz,
  ADD COLUMN IF NOT EXISTS quickbooks_purchase_journal_id text,
  ADD COLUMN IF NOT EXISTS purchase_sync_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS purchase_sync_error text;

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS quickbooks_invoice_id text,
  ADD COLUMN IF NOT EXISTS quickbooks_journal_id text,
  ADD COLUMN IF NOT EXISTS sync_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS sync_error text;

CREATE SEQUENCE IF NOT EXISTS public.invoice_number_seq START 1;
GRANT USAGE, SELECT ON SEQUENCE public.invoice_number_seq TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.next_invoice_number()
RETURNS text
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 'INV-' || LPAD(nextval('public.invoice_number_seq')::text, 6, '0');
$$;

GRANT EXECUTE ON FUNCTION public.next_invoice_number() TO authenticated, service_role;