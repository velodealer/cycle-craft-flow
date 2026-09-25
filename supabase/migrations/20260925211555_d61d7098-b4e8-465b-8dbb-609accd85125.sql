-- Part sales become real invoices: new enum value first.
ALTER TYPE public.invoice_type ADD VALUE IF NOT EXISTS 'part_sale' AFTER 'detailing';

-- Break postings recorded on the bike (additive, nullable).
ALTER TABLE public.bikes
  ADD COLUMN IF NOT EXISTS break_qb_posting_id text,
  ADD COLUMN IF NOT EXISTS break_qb_sync_status text,
  ADD COLUMN IF NOT EXISTS break_qb_sync_error text,
  ADD COLUMN IF NOT EXISTS break_xero_posting_id text,
  ADD COLUMN IF NOT EXISTS break_xero_sync_status text,
  ADD COLUMN IF NOT EXISTS break_xero_sync_error text;

-- Part-sale invoices: link to the part, optional walk-in customer, VAT scheme.
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS part_id uuid REFERENCES public.parts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS customer_name text,
  ADD COLUMN IF NOT EXISTS finance_scheme public.finance_scheme;
