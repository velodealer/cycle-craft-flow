DO $$
DECLARE
  t text;
  tenant_tables text[] := ARRAY[
    'profiles','bikes','bike_components','bike_collections','jobs','invoices','parts','components',
    'external_owners','quotes','quote_versions','sale_drafts','storage_bays','listing_templates',
    'inspections','inspection_faults','fulfilment_events','ebay_listings','shopify_listings',
    'typeform_forms','typeform_submissions','social_posts','social_scripts','social_post_checklist',
    'social_post_metrics','social_post_scores'
  ];
BEGIN
  FOREACH t IN ARRAY tenant_tables LOOP
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN business_id SET DEFAULT public.current_business_id()', t);
  END LOOP;
END $$;