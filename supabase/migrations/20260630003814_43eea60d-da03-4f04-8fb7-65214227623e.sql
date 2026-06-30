DROP INDEX IF EXISTS public.components_brand_model_mpn_uk;
CREATE UNIQUE INDEX components_category_brand_model_mpn_uk
  ON public.components (category_id, brand, model, COALESCE(mpn, ''));