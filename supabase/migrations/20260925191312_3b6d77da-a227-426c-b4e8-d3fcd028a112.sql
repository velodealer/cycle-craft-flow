ALTER TABLE public.ebay_listings ADD COLUMN IF NOT EXISTS environment text;
UPDATE public.ebay_listings SET environment = 'sandbox' WHERE environment IS NULL;