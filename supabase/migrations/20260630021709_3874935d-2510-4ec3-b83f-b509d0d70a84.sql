
CREATE TABLE public.listing_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform text NOT NULL UNIQUE CHECK (platform IN ('ebay','shopify','instagram','facebook')),
  format text NOT NULL DEFAULT 'text' CHECK (format IN ('html','text')),
  body text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.listing_templates TO authenticated;
GRANT ALL ON public.listing_templates TO service_role;

ALTER TABLE public.listing_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read listing templates"
  ON public.listing_templates FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins manage listing templates"
  ON public.listing_templates FOR ALL
  TO authenticated
  USING (public.has_role('admin'::user_role))
  WITH CHECK (public.has_role('admin'::user_role));

CREATE TRIGGER update_listing_templates_updated_at
  BEFORE UPDATE ON public.listing_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
