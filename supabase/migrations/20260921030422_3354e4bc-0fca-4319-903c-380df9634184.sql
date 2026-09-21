UPDATE public.ebay_listings
SET listing_url = 'https://www.sandbox.ebay.co.uk/itm/' || listing_id,
    updated_at = now()
WHERE listing_url IS NOT NULL
  AND listing_url NOT LIKE 'https://www.%';