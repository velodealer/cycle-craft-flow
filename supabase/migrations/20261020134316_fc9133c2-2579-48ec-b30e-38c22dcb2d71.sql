ALTER TABLE public.parts ADD COLUMN IF NOT EXISTS ebay_item_id text;
CREATE INDEX IF NOT EXISTS parts_ebay_item_id_idx ON public.parts (business_id, ebay_item_id) WHERE ebay_item_id IS NOT NULL;
ALTER TABLE public.ebay_orders ADD COLUMN IF NOT EXISTS part_id uuid REFERENCES public.parts(id) ON DELETE SET NULL;
ALTER TABLE public.ebay_orders ADD COLUMN IF NOT EXISTS invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL;