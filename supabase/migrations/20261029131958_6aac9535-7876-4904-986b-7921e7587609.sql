ALTER TABLE public.parts
  ADD COLUMN IF NOT EXISTS for_sale boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS listing_title text,
  ADD COLUMN IF NOT EXISTS listing_description text,
  ADD COLUMN IF NOT EXISTS listing_condition text NOT NULL DEFAULT 'USED_EXCELLENT',
  ADD COLUMN IF NOT EXISTS listing_photos text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS ebay_category_id text,
  ADD COLUMN IF NOT EXISTS ebay_sku text,
  ADD COLUMN IF NOT EXISTS ebay_offer_id text,
  ADD COLUMN IF NOT EXISTS ebay_environment text,
  ADD COLUMN IF NOT EXISTS ebay_listing_url text,
  ADD COLUMN IF NOT EXISTS ebay_listing_status text,
  ADD COLUMN IF NOT EXISTS ebay_last_error text,
  ADD COLUMN IF NOT EXISTS shopify_product_id text,
  ADD COLUMN IF NOT EXISTS shopify_variant_id text,
  ADD COLUMN IF NOT EXISTS shopify_inventory_item_id text,
  ADD COLUMN IF NOT EXISTS shopify_product_url text,
  ADD COLUMN IF NOT EXISTS shopify_listing_status text,
  ADD COLUMN IF NOT EXISTS shopify_last_error text;

CREATE INDEX IF NOT EXISTS parts_business_ebay_sku_idx ON public.parts (business_id, ebay_sku) WHERE ebay_sku IS NOT NULL;
CREATE INDEX IF NOT EXISTS parts_shopify_variant_idx ON public.parts (shopify_variant_id) WHERE shopify_variant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS parts_business_for_sale_idx ON public.parts (business_id) WHERE for_sale;