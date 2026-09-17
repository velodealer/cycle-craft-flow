
-- 1. Businesses
CREATE TABLE public.businesses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  contact_email text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.businesses TO authenticated;
GRANT ALL ON public.businesses TO service_role;
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.super_admins (
  user_id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.super_admins TO authenticated;
GRANT ALL ON public.super_admins TO service_role;
ALTER TABLE public.super_admins ENABLE ROW LEVEL SECURITY;

-- 2. business_id columns
ALTER TABLE public.profiles ADD COLUMN business_id uuid REFERENCES public.businesses(id);
ALTER TABLE public.bikes ADD COLUMN business_id uuid REFERENCES public.businesses(id);
ALTER TABLE public.bike_components ADD COLUMN business_id uuid REFERENCES public.businesses(id);
ALTER TABLE public.bike_collections ADD COLUMN business_id uuid REFERENCES public.businesses(id);
ALTER TABLE public.jobs ADD COLUMN business_id uuid REFERENCES public.businesses(id);
ALTER TABLE public.invoices ADD COLUMN business_id uuid REFERENCES public.businesses(id);
ALTER TABLE public.parts ADD COLUMN business_id uuid REFERENCES public.businesses(id);
ALTER TABLE public.components ADD COLUMN business_id uuid REFERENCES public.businesses(id);
ALTER TABLE public.external_owners ADD COLUMN business_id uuid REFERENCES public.businesses(id);
ALTER TABLE public.quotes ADD COLUMN business_id uuid REFERENCES public.businesses(id);
ALTER TABLE public.quote_versions ADD COLUMN business_id uuid REFERENCES public.businesses(id);
ALTER TABLE public.sale_drafts ADD COLUMN business_id uuid REFERENCES public.businesses(id);
ALTER TABLE public.storage_bays ADD COLUMN business_id uuid REFERENCES public.businesses(id);
ALTER TABLE public.listing_templates ADD COLUMN business_id uuid REFERENCES public.businesses(id);
ALTER TABLE public.inspections ADD COLUMN business_id uuid REFERENCES public.businesses(id);
ALTER TABLE public.inspection_faults ADD COLUMN business_id uuid REFERENCES public.businesses(id);
ALTER TABLE public.fulfilment_events ADD COLUMN business_id uuid REFERENCES public.businesses(id);
ALTER TABLE public.ebay_listings ADD COLUMN business_id uuid REFERENCES public.businesses(id);
ALTER TABLE public.shopify_listings ADD COLUMN business_id uuid REFERENCES public.businesses(id);
ALTER TABLE public.typeform_forms ADD COLUMN business_id uuid REFERENCES public.businesses(id);
ALTER TABLE public.typeform_submissions ADD COLUMN business_id uuid REFERENCES public.businesses(id);
ALTER TABLE public.social_posts ADD COLUMN business_id uuid REFERENCES public.businesses(id);
ALTER TABLE public.social_scripts ADD COLUMN business_id uuid REFERENCES public.businesses(id);
ALTER TABLE public.social_post_checklist ADD COLUMN business_id uuid REFERENCES public.businesses(id);
ALTER TABLE public.social_post_metrics ADD COLUMN business_id uuid REFERENCES public.businesses(id);
ALTER TABLE public.social_post_scores ADD COLUMN business_id uuid REFERENCES public.businesses(id);
ALTER TABLE public.integrations ADD COLUMN business_id uuid REFERENCES public.businesses(id);
ALTER TABLE public.app_settings ADD COLUMN business_id uuid REFERENCES public.businesses(id);

-- 3. Seed businesses and assign existing accounts
INSERT INTO public.businesses (name, contact_email, status) VALUES
  ('VDMS Ltd', 'info@velodealer.com', 'active'),
  ('Broximo Prestige Steeds', 'broxim0@outlook.com', 'active');

UPDATE public.profiles p SET business_id = b.id
FROM public.businesses b
WHERE b.name = 'Broximo Prestige Steeds'
  AND lower(p.email) IN ('broxim0@outlook.com','eveloce@outlook.com','sulnhussain@yahoo.com','jnh096506@gmail.com','jahan87@live.com','samkandr@gmail.com');

UPDATE public.profiles p SET business_id = b.id
FROM public.businesses b
WHERE b.name = 'VDMS Ltd' AND p.business_id IS NULL;

-- 4. Backfill all existing tenant data to VDMS Ltd, then enforce
DO $$
DECLARE
  t text;
  vdms uuid := (SELECT id FROM public.businesses WHERE name = 'VDMS Ltd');
  tenant_tables text[] := ARRAY[
    'bikes','bike_components','bike_collections','jobs','invoices','parts','components',
    'external_owners','quotes','quote_versions','sale_drafts','storage_bays','listing_templates',
    'inspections','inspection_faults','fulfilment_events','ebay_listings','shopify_listings',
    'typeform_forms','typeform_submissions','social_posts','social_scripts',
    'social_post_checklist','social_post_metrics','social_post_scores'
  ];
BEGIN
  FOREACH t IN ARRAY tenant_tables LOOP
    EXECUTE format('UPDATE public.%I SET business_id = $1 WHERE business_id IS NULL', t) USING vdms;
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN business_id SET NOT NULL', t);
  END LOOP;
END $$;

ALTER TABLE public.profiles ALTER COLUMN business_id SET NOT NULL;

-- 5. Helper functions
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.super_admins WHERE user_id = auth.uid())
$$;

CREATE OR REPLACE FUNCTION public.current_business_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT business_id FROM public.profiles WHERE user_id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.current_business_status()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT b.status FROM public.businesses b
  JOIN public.profiles p ON p.business_id = b.id
  WHERE p.user_id = auth.uid()
$$;

-- Default business_id on authenticated client inserts
CREATE OR REPLACE FUNCTION public.set_business_id_default()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.business_id IS NULL THEN
    NEW.business_id := public.current_business_id();
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  t text;
  tenant_tables text[] := ARRAY[
    'profiles','bikes','bike_components','bike_collections','jobs','invoices','parts','components',
    'external_owners','quotes','quote_versions','sale_drafts','storage_bays','listing_templates',
    'inspections','inspection_faults','fulfilment_events','ebay_listings','shopify_listings',
    'typeform_forms','typeform_submissions','social_posts','social_scripts',
    'social_post_checklist','social_post_metrics','social_post_scores','integrations','app_settings'
  ];
BEGIN
  FOREACH t IN ARRAY tenant_tables LOOP
    EXECUTE format('CREATE TRIGGER set_business_id_default_trigger BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_business_id_default()', t);
  END LOOP;
END $$;

CREATE TRIGGER update_businesses_updated_at BEFORE UPDATE ON public.businesses
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Tenant scoping (restrictive policies layer on top of existing role policies)
DO $$
DECLARE
  t text;
  scoped_active text[] := ARRAY[
    'bikes','bike_components','bike_collections','jobs','invoices','parts','components',
    'external_owners','quotes','quote_versions','sale_drafts','storage_bays','listing_templates',
    'inspections','inspection_faults','fulfilment_events','ebay_listings','shopify_listings',
    'typeform_forms','typeform_submissions','social_posts','social_scripts',
    'social_post_checklist','social_post_metrics','social_post_scores'
  ];
BEGIN
  FOREACH t IN ARRAY scoped_active LOOP
    EXECUTE format(
      'CREATE POLICY tenant_scope ON public.%I AS RESTRICTIVE TO authenticated '
      'USING (business_id = public.current_business_id() AND (public.is_super_admin() OR public.current_business_status() = ''active'')) '
      'WITH CHECK (business_id = public.current_business_id() AND (public.is_super_admin() OR public.current_business_status() = ''active''))', t);
  END LOOP;
END $$;

-- profiles: scoped but always readable so a pending business can see its own status
CREATE POLICY tenant_scope ON public.profiles AS RESTRICTIVE TO authenticated
USING (business_id = public.current_business_id() OR public.is_super_admin())
WITH CHECK (business_id = public.current_business_id() OR public.is_super_admin());

-- integrations & app_settings: shared (NULL) or own business
CREATE POLICY tenant_scope ON public.integrations AS RESTRICTIVE TO authenticated
USING (business_id IS NULL OR business_id = public.current_business_id() OR public.is_super_admin())
WITH CHECK (business_id IS NULL OR business_id = public.current_business_id() OR public.is_super_admin());

CREATE POLICY tenant_scope ON public.app_settings AS RESTRICTIVE TO authenticated
USING (business_id IS NULL OR business_id = public.current_business_id() OR public.is_super_admin())
WITH CHECK (business_id IS NULL OR business_id = public.current_business_id() OR public.is_super_admin());

-- 7. Policies for the new tables
CREATE POLICY "Members can view their business" ON public.businesses FOR SELECT TO authenticated
USING (id = public.current_business_id() OR public.is_super_admin());
CREATE POLICY "Super admins manage businesses" ON public.businesses FOR ALL TO authenticated
USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

CREATE POLICY "Users can view their super admin status" ON public.super_admins FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_super_admin());

-- 8. New sign-ups create a pending business; info@velodealer.com becomes the VDMS super admin
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_business uuid;
  v_name text;
BEGIN
  v_name := COALESCE(NEW.raw_user_meta_data->>'name', NEW.email);

  IF lower(NEW.email) = 'info@velodealer.com' THEN
    SELECT id INTO v_business FROM public.businesses WHERE name = 'VDMS Ltd' LIMIT 1;
    IF v_business IS NULL THEN
      INSERT INTO public.businesses (name, contact_email, status)
      VALUES ('VDMS Ltd', NEW.email, 'active') RETURNING id INTO v_business;
    END IF;
  ELSE
    INSERT INTO public.businesses (name, contact_email, status)
    VALUES (
      COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'business_name'), ''), v_name || '''s business'),
      NEW.email,
      'pending'
    ) RETURNING id INTO v_business;
  END IF;

  INSERT INTO public.profiles (user_id, name, email, role, business_id)
  VALUES (NEW.id, v_name, NEW.email, 'admin', v_business);

  IF lower(NEW.email) = 'info@velodealer.com' THEN
    INSERT INTO public.super_admins (user_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;
