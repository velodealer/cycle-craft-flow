CREATE OR REPLACE FUNCTION public.link_bike_components(_bike_id uuid, _components jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  _biz uuid; _c jsonb; _cat uuid; _comp uuid;
  _brand text; _model text; _mpn text; _attrs jsonb; _desc text;
  _linked int := 0; _slots text[] := '{}';
BEGIN
  SELECT business_id INTO _biz FROM bikes WHERE id = _bike_id;
  IF _biz IS NULL THEN RAISE EXCEPTION 'Bike not found or not accessible'; END IF;
  IF jsonb_typeof(_components) <> 'array' THEN RAISE EXCEPTION 'components must be an array'; END IF;

  FOR _c IN SELECT * FROM jsonb_array_elements(_components) LOOP
    _brand := left(nullif(trim(_c->>'brand'), ''), 120);
    _model := left(nullif(trim(_c->>'model'), ''), 200);
    _mpn := nullif(trim(_c->>'mpn'), '');
    _desc := nullif(trim(_c->>'description'), '');
    _attrs := CASE WHEN jsonb_typeof(_c->'attributes') = 'object' AND _c->'attributes' <> '{}'::jsonb THEN _c->'attributes' END;
    IF coalesce(_c->>'slot', '') = '' OR _brand IS NULL OR _model IS NULL THEN
      RAISE EXCEPTION 'Part % is missing slot, brand or model', coalesce(_c->>'slot', '?');
    END IF;

    SELECT id INTO _cat FROM component_categories WHERE slug = _c->>'categorySlug';
    IF _cat IS NULL THEN SELECT id INTO _cat FROM component_categories WHERE slug = 'accessories'; END IF;

    -- Reuse only when the spec matches: same description (or none on either side) and no conflicting attributes.
    SELECT co.id INTO _comp FROM components co
      WHERE co.business_id = _biz AND co.category_id = _cat AND co.brand = _brand AND co.model = _model
        AND coalesce(co.mpn, '') = coalesce(_mpn, '')
        AND lower(regexp_replace(coalesce(co.description, ''), '\s+', ' ', 'g'))
            = lower(regexp_replace(coalesce(_desc, ''), '\s+', ' ', 'g'))
        AND NOT EXISTS (
          SELECT 1 FROM jsonb_each(coalesce(co.attributes, '{}'::jsonb)) a
          JOIN jsonb_each(coalesce(_attrs, '{}'::jsonb)) b ON a.key = b.key
          WHERE a.value IS DISTINCT FROM b.value)
      ORDER BY co.created_at
      LIMIT 1;

    IF _comp IS NULL THEN
      INSERT INTO components (business_id, category_id, brand, model, mpn, description, weight_g, attributes, source, raw_text)
      VALUES (_biz, _cat, _brand, _model, _mpn, _desc,
              nullif(_c->>'weightG', '')::numeric, coalesce(_attrs, '{}'::jsonb), '99spokes', _desc)
      RETURNING id INTO _comp;
    ELSE
      UPDATE components SET weight_g = coalesce(weight_g, nullif(_c->>'weightG', '')::numeric)
      WHERE id = _comp AND weight_g IS NULL;
    END IF;

    INSERT INTO bike_components (bike_id, business_id, slot, component_id, position, notes, brand, model, mpn, attributes)
    VALUES (_bike_id, _biz, _c->>'slot', _comp, nullif(_c->>'position', ''), _desc, _brand, _model, _mpn, _attrs)
    ON CONFLICT (bike_id, slot) DO UPDATE SET
      component_id = EXCLUDED.component_id, position = EXCLUDED.position, notes = EXCLUDED.notes,
      brand = EXCLUDED.brand, model = EXCLUDED.model, mpn = EXCLUDED.mpn, attributes = EXCLUDED.attributes;

    _linked := _linked + 1;
    _slots := _slots || (_c->>'slot');
  END LOOP;

  RETURN jsonb_build_object('linked', _linked, 'total', jsonb_array_length(_components), 'slots', to_jsonb(_slots));
END;
$function$;