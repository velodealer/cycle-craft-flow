
-- Bikes: view and edit (no delete)
CREATE POLICY "Customer service can view bikes" ON public.bikes
  FOR SELECT TO authenticated USING (public.has_role('customer_service'::user_role));
CREATE POLICY "Customer service can update bikes" ON public.bikes
  FOR UPDATE TO authenticated USING (public.has_role('customer_service'::user_role))
  WITH CHECK (public.has_role('customer_service'::user_role));

-- Components / fitted components
CREATE POLICY "Customer service can manage components" ON public.components
  FOR ALL TO authenticated USING (public.has_role('customer_service'::user_role))
  WITH CHECK (public.has_role('customer_service'::user_role));
CREATE POLICY "Customer service can manage bike components" ON public.bike_components
  FOR ALL TO authenticated USING (public.has_role('customer_service'::user_role))
  WITH CHECK (public.has_role('customer_service'::user_role));

-- Parts
CREATE POLICY "Customer service can manage parts" ON public.parts
  FOR ALL TO authenticated USING (public.has_role('customer_service'::user_role))
  WITH CHECK (public.has_role('customer_service'::user_role));

-- Marketplace listings
CREATE POLICY "Customer service can view ebay listings" ON public.ebay_listings
  FOR SELECT TO authenticated USING (public.has_role('customer_service'::user_role));
CREATE POLICY "Customer service can insert ebay listings" ON public.ebay_listings
  FOR INSERT TO authenticated WITH CHECK (public.has_role('customer_service'::user_role));
CREATE POLICY "Customer service can update ebay listings" ON public.ebay_listings
  FOR UPDATE TO authenticated USING (public.has_role('customer_service'::user_role))
  WITH CHECK (public.has_role('customer_service'::user_role));

CREATE POLICY "Customer service can view shopify listings" ON public.shopify_listings
  FOR SELECT TO authenticated USING (public.has_role('customer_service'::user_role));
CREATE POLICY "Customer service can insert shopify listings" ON public.shopify_listings
  FOR INSERT TO authenticated WITH CHECK (public.has_role('customer_service'::user_role));
CREATE POLICY "Customer service can update shopify listings" ON public.shopify_listings
  FOR UPDATE TO authenticated USING (public.has_role('customer_service'::user_role))
  WITH CHECK (public.has_role('customer_service'::user_role));

-- Collections and deliveries
CREATE POLICY "Customer service can manage collections" ON public.bike_collections
  FOR ALL TO authenticated USING (public.has_role('customer_service'::user_role))
  WITH CHECK (public.has_role('customer_service'::user_role));

-- Customer submissions
CREATE POLICY "Customer service can view submissions" ON public.typeform_submissions
  FOR SELECT TO authenticated USING (public.has_role('customer_service'::user_role));
CREATE POLICY "Customer service can update submissions" ON public.typeform_submissions
  FOR UPDATE TO authenticated USING (public.has_role('customer_service'::user_role))
  WITH CHECK (public.has_role('customer_service'::user_role));

-- Activity trail
CREATE POLICY "Customer service can view bike activity" ON public.bike_activity
  FOR SELECT TO authenticated USING (public.has_role('customer_service'::user_role));
CREATE POLICY "Customer service can insert bike activity" ON public.bike_activity
  FOR INSERT TO authenticated WITH CHECK (public.has_role('customer_service'::user_role));
