ALTER TABLE public.bikes
  ADD COLUMN IF NOT EXISTS acquired_via text NOT NULL DEFAULT 'purchase',
  ADD COLUMN IF NOT EXISTS part_exchange_invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL;

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS part_exchange_bike_id uuid REFERENCES public.bikes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS part_exchange_value numeric,
  ADD COLUMN IF NOT EXISTS sale_gross numeric;

CREATE INDEX IF NOT EXISTS bikes_part_exchange_invoice_id_idx ON public.bikes(part_exchange_invoice_id);
CREATE INDEX IF NOT EXISTS invoices_part_exchange_bike_id_idx ON public.invoices(part_exchange_bike_id);