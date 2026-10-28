CREATE INDEX IF NOT EXISTS app_settings_business_id_idx ON public.app_settings (business_id);
CREATE INDEX IF NOT EXISTS bike_collections_business_id_idx ON public.bike_collections (business_id);
CREATE INDEX IF NOT EXISTS bike_components_business_id_idx ON public.bike_components (business_id);
CREATE INDEX IF NOT EXISTS build_parts_business_id_idx ON public.build_parts (business_id);
CREATE INDEX IF NOT EXISTS ebay_listings_business_id_idx ON public.ebay_listings (business_id);
CREATE INDEX IF NOT EXISTS external_owners_business_id_idx ON public.external_owners (business_id);
CREATE INDEX IF NOT EXISTS fulfilment_events_business_id_idx ON public.fulfilment_events (business_id);
CREATE INDEX IF NOT EXISTS inspections_business_id_idx ON public.inspections (business_id);
CREATE INDEX IF NOT EXISTS integrations_business_id_idx ON public.integrations (business_id);
CREATE INDEX IF NOT EXISTS listing_templates_business_id_idx ON public.listing_templates (business_id);
CREATE INDEX IF NOT EXISTS profiles_business_id_idx ON public.profiles (business_id);
CREATE INDEX IF NOT EXISTS quote_versions_business_id_idx ON public.quote_versions (business_id);
CREATE INDEX IF NOT EXISTS quotes_business_id_idx ON public.quotes (business_id);
CREATE INDEX IF NOT EXISTS sale_drafts_business_id_idx ON public.sale_drafts (business_id);
CREATE INDEX IF NOT EXISTS shopify_listings_business_id_idx ON public.shopify_listings (business_id);
CREATE INDEX IF NOT EXISTS social_post_checklist_business_id_idx ON public.social_post_checklist (business_id);
CREATE INDEX IF NOT EXISTS social_post_metrics_business_id_idx ON public.social_post_metrics (business_id);
CREATE INDEX IF NOT EXISTS social_post_scores_business_id_idx ON public.social_post_scores (business_id);
CREATE INDEX IF NOT EXISTS social_posts_business_id_idx ON public.social_posts (business_id);
CREATE INDEX IF NOT EXISTS social_scripts_business_id_idx ON public.social_scripts (business_id);
CREATE INDEX IF NOT EXISTS storage_bays_business_sort_idx ON public.storage_bays (business_id, sort_order);
CREATE INDEX IF NOT EXISTS typeform_forms_business_id_idx ON public.typeform_forms (business_id);
CREATE INDEX IF NOT EXISTS typeform_submissions_business_id_idx ON public.typeform_submissions (business_id);
CREATE INDEX IF NOT EXISTS data_deletion_requests_business_id_idx ON public.data_deletion_requests (business_id);

-- Defence in depth: make these dealership rules restrictive like every other table (same conditions)
DROP POLICY tenant_scope ON public.business_subscriptions;
CREATE POLICY tenant_scope ON public.business_subscriptions AS RESTRICTIVE FOR ALL TO authenticated
  USING ((business_id = (SELECT public.current_business_id())) OR (SELECT public.is_super_admin()))
  WITH CHECK ((business_id = (SELECT public.current_business_id())) OR (SELECT public.is_super_admin()));
DROP POLICY tenant_scope ON public.inspectabike_connections;
CREATE POLICY tenant_scope ON public.inspectabike_connections AS RESTRICTIVE FOR ALL TO authenticated
  USING ((business_id = (SELECT public.current_business_id())) OR (SELECT public.is_super_admin()))
  WITH CHECK ((business_id = (SELECT public.current_business_id())) OR (SELECT public.is_super_admin()));