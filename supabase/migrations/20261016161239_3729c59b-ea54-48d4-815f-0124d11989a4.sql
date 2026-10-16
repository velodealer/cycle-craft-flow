DROP INDEX IF EXISTS public.components_business_category_brand_model_mpn_uk;
ALTER TABLE public.components DROP CONSTRAINT IF EXISTS components_business_category_brand_model_mpn_uk;
CREATE UNIQUE INDEX components_business_category_brand_model_mpn_desc_uk ON public.components
  (business_id, category_id, brand, model, COALESCE(mpn, ''), lower(regexp_replace(COALESCE(description, ''), '\s+', ' ', 'g')));