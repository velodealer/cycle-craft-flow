ALTER TABLE public.parts
  ADD COLUMN IF NOT EXISTS fit_qb_posting_id text,
  ADD COLUMN IF NOT EXISTS fit_qb_sync_status text,
  ADD COLUMN IF NOT EXISTS fit_qb_sync_error text,
  ADD COLUMN IF NOT EXISTS fit_xero_posting_id text,
  ADD COLUMN IF NOT EXISTS fit_xero_sync_status text,
  ADD COLUMN IF NOT EXISTS fit_xero_sync_error text;