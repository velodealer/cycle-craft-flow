DROP INDEX IF EXISTS public.components_category_brand_model_mpn_uk;
CREATE UNIQUE INDEX components_business_category_brand_model_mpn_uk
  ON public.components (business_id, category_id, brand, model, COALESCE(mpn, ''));

CREATE OR REPLACE FUNCTION public.link_bike_components(_bike_id uuid, _components jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  _biz uuid;
  _c jsonb;
  _cat uuid;
  _comp uuid;
  _brand text; _model text; _mpn text; _attrs jsonb;
  _linked int := 0;
  _slots text[] := '{}';
BEGIN
  SELECT business_id INTO _biz FROM bikes WHERE id = _bike_id;
  IF _biz IS NULL THEN RAISE EXCEPTION 'Bike not found or not accessible'; END IF;
  IF jsonb_typeof(_components) <> 'array' THEN RAISE EXCEPTION 'components must be an array'; END IF;

  FOR _c IN SELECT * FROM jsonb_array_elements(_components) LOOP
    _brand := left(nullif(trim(_c->>'brand'), ''), 120);
    _model := left(nullif(trim(_c->>'model'), ''), 200);
    _mpn := nullif(trim(_c->>'mpn'), '');
    _attrs := CASE WHEN jsonb_typeof(_c->'attributes') = 'object' AND _c->'attributes' <> '{}'::jsonb THEN _c->'attributes' END;
    IF coalesce(_c->>'slot', '') = '' OR _brand IS NULL OR _model IS NULL THEN
      RAISE EXCEPTION 'Part % is missing slot, brand or model', coalesce(_c->>'slot', '?');
    END IF;

    SELECT id INTO _cat FROM component_categories WHERE slug = _c->>'categorySlug';
    IF _cat IS NULL THEN SELECT id INTO _cat FROM component_categories WHERE slug = 'accessories'; END IF;

    SELECT id INTO _comp FROM components
      WHERE business_id = _biz AND category_id = _cat AND brand = _brand AND model = _model
        AND coalesce(mpn, '') = coalesce(_mpn, '')
      LIMIT 1;

    IF _comp IS NULL THEN
      INSERT INTO components (business_id, category_id, brand, model, mpn, description, weight_g, attributes, source, raw_text)
      VALUES (_biz, _cat, _brand, _model, _mpn, nullif(_c->>'description', ''),
              nullif(_c->>'weightG', '')::numeric, coalesce(_attrs, '{}'::jsonb), '99spokes', nullif(_c->>'description', ''))
      RETURNING id INTO _comp;
    ELSE
      UPDATE components SET
        description = coalesce(description, nullif(_c->>'description', '')),
        weight_g = coalesce(weight_g, nullif(_c->>'weightG', '')::numeric)
      WHERE id = _comp AND (description IS NULL OR weight_g IS NULL);
    END IF;

    INSERT INTO bike_components (bike_id, business_id, slot, component_id, position, notes, brand, model, mpn, attributes)
    VALUES (_bike_id, _biz, _c->>'slot', _comp, nullif(_c->>'position', ''), nullif(_c->>'description', ''), _brand, _model, _mpn, _attrs)
    ON CONFLICT (bike_id, slot) DO UPDATE SET
      component_id = EXCLUDED.component_id, position = EXCLUDED.position, notes = EXCLUDED.notes,
      brand = EXCLUDED.brand, model = EXCLUDED.model, mpn = EXCLUDED.mpn, attributes = EXCLUDED.attributes;

    _linked := _linked + 1;
    _slots := _slots || (_c->>'slot');
  END LOOP;

  RETURN jsonb_build_object('linked', _linked, 'total', jsonb_array_length(_components), 'slots', to_jsonb(_slots));
END;
$$;

GRANT EXECUTE ON FUNCTION public.link_bike_components(uuid, jsonb) TO authenticated;