## Issue

`components_brand_model_mpn_uk` is on `(brand, model, COALESCE(mpn, ''))` — no `category_id`. So a Rear Derailleur with the same brand/model/MPN as an existing Front Derailleur is rejected.

## Fix

Single migration:

```sql
DROP INDEX IF EXISTS public.components_brand_model_mpn_uk;
CREATE UNIQUE INDEX components_category_brand_model_mpn_uk
  ON public.components (category_id, brand, model, COALESCE(mpn, ''));
```

Uniqueness is now scoped per category. No code changes.
