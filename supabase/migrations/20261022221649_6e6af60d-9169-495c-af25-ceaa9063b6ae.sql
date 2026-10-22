-- helper: current profile id
CREATE OR REPLACE FUNCTION public.current_profile_id() RETURNS uuid
LANGUAGE sql STABLE SET search_path = public AS $$ SELECT id FROM public.profiles WHERE user_id = auth.uid() $$;

CREATE OR REPLACE FUNCTION public._log_bike(_bike uuid, _kind text, _action text, _summary text, _detail jsonb)
RETURNS void LANGUAGE sql SET search_path = public AS $$
  INSERT INTO public.bike_activity (bike_id, kind, action, summary, detail, actor_id)
  VALUES (_bike, _kind, _action, _summary, coalesce(_detail,'{}'::jsonb), public.current_profile_id());
$$;

-- 1. Record bike sale -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_bike_sale(p jsonb) RETURNS jsonb
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  _bike uuid := (p->>'bike_id')::uuid;
  _b record; _cust uuid; _px uuid; _num text; _inv uuid; _issued timestamptz;
  _gross numeric := (p->>'sale_gross')::numeric;
  _balance numeric := (p->>'balance')::numeric;
  _pxval numeric := nullif(p->>'part_exchange_value','')::numeric;
  _absorbed numeric := coalesce(nullif(p->>'absorbed_delivery','')::numeric, 0);
  _note text := nullif(trim(coalesce(p->>'note','')), '');
BEGIN
  SELECT id, delivery_cost, condition_notes INTO _b FROM bikes WHERE id = _bike FOR UPDATE;
  IF _b.id IS NULL THEN RAISE EXCEPTION 'Bike not found'; END IF;
  IF _gross IS NULL OR _gross < 0 OR _balance IS NULL THEN RAISE EXCEPTION 'Sale price is missing or invalid'; END IF;
  IF _pxval IS NOT NULL AND _pxval < 0 THEN RAISE EXCEPTION 'Part exchange value cannot be negative'; END IF;
  IF EXISTS (SELECT 1 FROM invoices WHERE bike_id = _bike AND type = 'sale' AND status <> 'cancelled') THEN
    RAISE EXCEPTION 'This bike already has a sale invoice. Mark its deposit or payment, or delete it first.';
  END IF;
  _issued := coalesce((p->>'issued_at')::timestamptz, now());

  _cust := nullif(p->>'customer_id','')::uuid;
  IF p ? 'new_customer' AND p->'new_customer' <> 'null'::jsonb THEN
    IF coalesce(trim(p->'new_customer'->>'name'),'') = '' THEN RAISE EXCEPTION 'Customer name is required'; END IF;
    INSERT INTO external_owners (name, email, phone, address)
    VALUES (trim(p->'new_customer'->>'name'), nullif(trim(p->'new_customer'->>'email'),''),
            nullif(trim(p->'new_customer'->>'phone'),''), nullif(trim(p->'new_customer'->>'address'),''))
    RETURNING id INTO _cust;
  END IF;

  IF _pxval IS NOT NULL THEN
    _px := nullif(p->>'part_exchange_bike_id','')::uuid;
    IF _px IS NOT NULL THEN
      UPDATE bikes SET purchase_price = _pxval WHERE id = _px;
      IF NOT FOUND THEN RAISE EXCEPTION 'Part exchange bike not found'; END IF;
    ELSIF p ? 'part_exchange' AND p->'part_exchange' <> 'null'::jsonb THEN
      IF coalesce(trim(p->'part_exchange'->>'make'),'') = '' OR coalesce(trim(p->'part_exchange'->>'model'),'') = '' THEN
        RAISE EXCEPTION 'Part exchange make and model are required';
      END IF;
      INSERT INTO bikes (make, model, frame_number, size, colour, source, status, finance_scheme,
                         purchase_price, purchase_date, intake_date, acquired_via, external_owner_id)
      VALUES (trim(p->'part_exchange'->>'make'), trim(p->'part_exchange'->>'model'),
              nullif(trim(p->'part_exchange'->>'frame_number'),''), nullif(trim(p->'part_exchange'->>'size'),''),
              nullif(trim(p->'part_exchange'->>'colour'),''), 'owned', 'intake',
              coalesce(nullif(p->'part_exchange'->>'finance_scheme',''),'margin_scheme')::finance_scheme,
              _pxval, _issued, _issued, 'part_exchange', _cust)
      RETURNING id INTO _px;
    END IF;
  END IF;

  _num := public.next_invoice_number(NULL);
  INSERT INTO invoices (invoice_number, bike_id, external_customer_id, type, total, net, gross, sale_gross,
    delivery_charge, delivery_charged_to_customer, part_exchange_bike_id, part_exchange_value, vat_rate, is_export,
    status, issued_at)
  VALUES (_num, _bike, _cust, 'sale', round(_balance,2), round((p->>'net')::numeric,2), round(_balance,2), round(_gross,2),
    round(coalesce(nullif(p->>'delivery_charge','')::numeric,0),2), coalesce((p->>'delivery_charged_to_customer')::boolean,false),
    _px, CASE WHEN _px IS NOT NULL THEN round(_pxval,2) END, coalesce((p->>'vat_rate')::numeric,0),
    coalesce((p->>'is_export')::boolean,false), 'issued', _issued)
  RETURNING id INTO _inv;

  IF _px IS NOT NULL THEN UPDATE bikes SET part_exchange_invoice_id = _inv WHERE id = _px; END IF;

  UPDATE bikes SET
    sale_price = _gross,
    delivery_method = coalesce(nullif(p->>'delivery_method',''), delivery_method),
    delivery_cost = CASE WHEN _absorbed > 0 THEN coalesce(delivery_cost,0) + _absorbed ELSE delivery_cost END,
    condition_notes = CASE WHEN _note IS NOT NULL THEN concat_ws(E'\n\n', nullif(condition_notes,''), 'Sale note: ' || _note) ELSE condition_notes END
  WHERE id = _bike;

  PERFORM public._log_bike(_bike, 'sale', 'sold',
    'Sold for £' || to_char(_gross,'FM999,999,990.00') || ' — invoice ' || _num ||
    CASE WHEN _px IS NOT NULL THEN ', part exchange taken at £' || to_char(_pxval,'FM999,999,990.00') ELSE '' END,
    jsonb_build_object('invoice_id', _inv, 'invoice_number', _num, 'sale_gross', _gross, 'balance', _balance,
                       'part_exchange_bike_id', _px, 'note', _note));
  IF _px IS NOT NULL THEN
    PERFORM public._log_bike(_px, 'bike', 'created',
      'Taken in part exchange against invoice ' || _num || ' at £' || to_char(_pxval,'FM999,999,990.00'),
      jsonb_build_object('invoice_id', _inv));
  END IF;
  DELETE FROM sale_drafts WHERE bike_id = _bike;

  RETURN jsonb_build_object('invoice_id', _inv, 'invoice_number', _num, 'part_exchange_bike_id', _px, 'customer_id', _cust);
END $$;

-- 2. Part sale (VAT worked out here) -----------------------------------------
CREATE OR REPLACE FUNCTION public.record_part_sale(_part_id uuid, _gross numeric, _scheme text, _is_export boolean,
  _customer_name text, _sale_date date) RETURNS jsonb
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE _p record; _vatreg boolean; _export boolean; _net numeric; _rate numeric := 0; _num text; _inv uuid; _cost numeric;
BEGIN
  IF _gross IS NULL OR _gross <= 0 THEN RAISE EXCEPTION 'Enter a sale price above zero'; END IF;
  IF _scheme NOT IN ('vat_qualifying','margin_scheme') THEN RAISE EXCEPTION 'Unknown VAT scheme'; END IF;
  SELECT * INTO _p FROM parts WHERE id = _part_id FOR UPDATE;
  IF _p.id IS NULL THEN RAISE EXCEPTION 'Part not found'; END IF;
  IF _p.stock_status <> 'in_stock' OR _p.bike_id IS NOT NULL THEN RAISE EXCEPTION 'That part is no longer in stock'; END IF;
  SELECT NOT (value = 'false'::jsonb) INTO _vatreg FROM app_settings WHERE key = 'vat_registered:' || _p.business_id;
  _vatreg := coalesce(_vatreg, true);
  _cost := abs(coalesce(_p.cost_price,0));
  _export := _vatreg AND _scheme = 'vat_qualifying' AND coalesce(_is_export,false);
  IF NOT _vatreg OR _export THEN _net := _gross;
  ELSIF _scheme = 'margin_scheme' THEN _net := _gross - greatest(0, _gross - _cost) / 6;
  ELSE _net := _gross / 1.2; _rate := 20; END IF;

  _num := public.next_invoice_number(NULL);
  INSERT INTO invoices (invoice_number, part_id, type, total, net, gross, sale_gross, vat_rate, finance_scheme,
                        is_export, customer_name, status, issued_at)
  VALUES (_num, _part_id, 'part_sale', round(_gross,2), round(_net,2), round(_gross,2), round(_gross,2), _rate,
          CASE WHEN _vatreg THEN _scheme::finance_scheme END, _export, nullif(trim(_customer_name),''), 'issued',
          (coalesce(_sale_date, current_date)::text || 'T12:00:00Z')::timestamptz)
  RETURNING id INTO _inv;
  UPDATE parts SET stock_status = 'sold', sale_price = _gross WHERE id = _part_id;
  RETURN jsonb_build_object('invoice_id', _inv, 'invoice_number', _num);
END $$;

-- 3. Parts moves --------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._strip_to_stock(_bike uuid, _credit_desc text, _inv_desc text, _brand text, _mpn text, _value numeric)
RETURNS uuid LANGUAGE plpgsql SET search_path = public AS $$
DECLARE _id uuid;
BEGIN
  IF _value IS NULL OR _value < 0 THEN RAISE EXCEPTION 'Enter a valid value'; END IF;
  INSERT INTO parts (bike_id, description, brand, cost_price, quantity, stock_status, type)
  VALUES (_bike, _credit_desc, nullif(_brand,''), -abs(_value), 1, 'sold', 'secondhand_stripped');
  INSERT INTO parts (description, brand, part_number, cost_price, quantity, stripped_from_bike_id, stock_status, type)
  VALUES (_inv_desc, nullif(_brand,''), nullif(_mpn,''), _value, 1, _bike, 'in_stock', 'secondhand_stripped')
  RETURNING id INTO _id;
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.fit_stock_part(p jsonb) RETURNS jsonb
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE _bike uuid := (p->>'bike_id')::uuid; _part uuid := (p->>'part_id')::uuid; _cost numeric := (p->>'cost')::numeric;
  _sel record; _slot text := nullif(p->>'slot',''); _cat uuid; _comp uuid; _brand text; _model text; _mpn text;
BEGIN
  IF _cost IS NULL OR _cost < 0 THEN RAISE EXCEPTION 'Enter a valid cost'; END IF;
  PERFORM 1 FROM bikes WHERE id = _bike FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Bike not found'; END IF;
  IF coalesce((p->>'return_old')::boolean,false) THEN
    PERFORM public._strip_to_stock(_bike, p->>'old_credit_desc', p->>'old_inventory_desc', p->>'old_brand', p->>'old_mpn', (p->>'old_value')::numeric);
  END IF;
  UPDATE parts SET bike_id = _bike, stock_status = 'sold', cost_price = _cost
   WHERE id = _part AND bike_id IS NULL AND stock_status = 'in_stock'
  RETURNING brand, description, part_number INTO _sel;
  IF NOT FOUND THEN RAISE EXCEPTION 'That part is no longer in stock'; END IF;
  IF _slot IS NOT NULL THEN
    _brand := coalesce(nullif(trim(_sel.brand),''), 'Unbranded');
    _model := coalesce(nullif(trim(regexp_replace(coalesce(_sel.description,''), '^[^:]+:\s*', '')),''), p->>'slot_label', _slot);
    _mpn := nullif(trim(coalesce(_sel.part_number,'')),'');
    SELECT id INTO _cat FROM component_categories WHERE slug = coalesce(nullif(p->>'category_slug',''),'accessories');
    IF _cat IS NULL THEN SELECT id INTO _cat FROM component_categories WHERE slug = 'accessories'; END IF;
    IF _cat IS NULL THEN RAISE EXCEPTION 'Component category not found'; END IF;
    SELECT id INTO _comp FROM components WHERE category_id = _cat AND brand = _brand AND model = _model
      AND coalesce(mpn,'') = coalesce(_mpn,'') ORDER BY created_at LIMIT 1;
    IF _comp IS NULL THEN
      INSERT INTO components (category_id, brand, model, mpn, source) VALUES (_cat, _brand, _model, _mpn, 'manual') RETURNING id INTO _comp;
    END IF;
    INSERT INTO bike_components (bike_id, slot, component_id, position, brand, model, mpn, attributes, spec_overrides, notes)
    VALUES (_bike, _slot, _comp, nullif(p->>'position',''), NULL, NULL, NULL, NULL, NULL, NULL)
    ON CONFLICT (bike_id, slot) DO UPDATE SET component_id = EXCLUDED.component_id, position = EXCLUDED.position,
      brand = NULL, model = NULL, mpn = NULL, attributes = NULL, spec_overrides = NULL, notes = NULL;
  END IF;
  PERFORM public._log_bike(_bike, 'cost', 'part_fitted',
    'Fitted from stock: ' || concat_ws(' ', _sel.brand, _sel.description) || coalesce(' (' || (p->>'slot_label') || ')', ''),
    jsonb_build_object('part_id', _part, 'cost', _cost, 'slot', _slot, 'returned_old', coalesce((p->>'return_old')::boolean,false)));
  RETURN jsonb_build_object('ok', true);
END $$;

CREATE OR REPLACE FUNCTION public.remove_slot_part(p jsonb) RETURNS jsonb
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE _bike uuid := (p->>'bike_id')::uuid; _slot text := p->>'slot'; _mode text := p->>'mode';
  _part uuid := nullif(p->>'part_id','')::uuid; _v numeric := coalesce(nullif(p->>'value','')::numeric, 0);
  _orig numeric; _brand text; _label text := coalesce(p->>'label', _slot); _sl text := coalesce(p->>'slot_label', _slot);
BEGIN
  IF _mode NOT IN ('stock','discard') THEN RAISE EXCEPTION 'Unknown removal mode'; END IF;
  IF _mode = 'stock' AND _v < 0 THEN RAISE EXCEPTION 'Enter a valid value'; END IF;
  IF _mode = 'stock' AND _part IS NOT NULL THEN
    SELECT cost_price, brand INTO _orig, _brand FROM parts WHERE id = _part AND bike_id = _bike FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'That part is no longer on this bike'; END IF;
    UPDATE parts SET bike_id = NULL, stock_status = 'in_stock', cost_price = _v WHERE id = _part;
    IF coalesce(_orig,0) - _v > 0.005 THEN
      INSERT INTO parts (bike_id, description, brand, cost_price, quantity, stock_status, type)
      VALUES (_bike, 'Value lost on removed ' || lower(_sl) || ' — ' || _label, _brand, round(_orig - _v, 2), 1, 'sold', 'secondhand_stripped');
    END IF;
  ELSIF _mode = 'stock' THEN
    PERFORM public._strip_to_stock(_bike, 'Stripped: ' || _sl || ' — ' || _label, _sl || ': ' || _label, p->>'brand', p->>'mpn', _v);
  END IF;
  DELETE FROM bike_components WHERE bike_id = _bike AND slot = _slot;
  PERFORM public._log_bike(_bike, 'cost', CASE WHEN _mode='stock' THEN 'part_removed_to_stock' ELSE 'part_removed' END,
    CASE WHEN _mode='stock' THEN 'Returned to stock: ' ELSE 'Removed from spec: ' END || _label || ' (' || _sl || ')',
    jsonb_build_object('slot', _slot, 'part_id', _part, 'value', CASE WHEN _mode='stock' THEN _v END));
  RETURN jsonb_build_object('ok', true);
END $$;

CREATE OR REPLACE FUNCTION public.strip_component(p jsonb) RETURNS jsonb
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE _bike uuid := (p->>'bike_id')::uuid; _slot text := p->>'slot'; _label text := coalesce(p->>'label', _slot);
  _sl text := coalesce(p->>'slot_label', _slot);
BEGIN
  PERFORM public._strip_to_stock(_bike, 'Stripped: ' || _sl || ' — ' || _label, _sl || ': ' || _label, p->>'brand', p->>'mpn', (p->>'value')::numeric);
  DELETE FROM bike_components WHERE bike_id = _bike AND slot = _slot;
  PERFORM public._log_bike(_bike, 'cost', 'part_removed_to_stock', 'Stripped to stock: ' || _label || ' (' || _sl || ')',
    jsonb_build_object('slot', _slot, 'value', (p->>'value')::numeric));
  RETURN jsonb_build_object('ok', true);
END $$;

CREATE OR REPLACE FUNCTION public.break_bike(_bike_id uuid, _items jsonb) RETURNS jsonb
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE _i jsonb; _v numeric; _n int := 0; _status text;
BEGIN
  SELECT status::text INTO _status FROM bikes WHERE id = _bike_id FOR UPDATE;
  IF _status IS NULL THEN RAISE EXCEPTION 'Bike not found'; END IF;
  IF _status IN ('sold','split_for_parts','collected','delivered') THEN RAISE EXCEPTION 'This bike can no longer be broken for parts'; END IF;
  IF jsonb_typeof(_items) <> 'array' THEN RAISE EXCEPTION 'items must be a list'; END IF;
  FOR _i IN SELECT * FROM jsonb_array_elements(_items) LOOP
    _v := (_i->>'value')::numeric;
    IF _v IS NULL OR _v < 0 THEN RAISE EXCEPTION 'Set a value for every kept part'; END IF;
    IF _i->>'kind' = 'part' THEN
      UPDATE parts SET bike_id = NULL, stripped_from_bike_id = _bike_id, stock_status = 'in_stock',
        type = 'secondhand_stripped', cost_price = _v, quantity = 1
       WHERE id = (_i->>'id')::uuid AND bike_id = _bike_id;
      IF NOT FOUND THEN RAISE EXCEPTION 'A part is no longer on this bike'; END IF;
    ELSE
      PERFORM public._strip_to_stock(_bike_id, _i->>'credit_desc', _i->>'inventory_desc', _i->>'brand', NULL, _v);
      DELETE FROM bike_components WHERE bike_id = _bike_id
        AND id IN (SELECT (jsonb_array_elements_text(coalesce(_i->'component_ids','[]'::jsonb)))::uuid);
    END IF;
    _n := _n + 1;
  END LOOP;
  UPDATE bikes SET status = 'split_for_parts' WHERE id = _bike_id;
  PERFORM public._log_bike(_bike_id, 'status_change', 'split_for_parts', 'Bike split for parts', jsonb_build_object('kept', _n));
  RETURN jsonb_build_object('kept', _n);
END $$;

-- 4. Stage changes -------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_handover() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status::text IN ('collected','delivered')
     AND auth.uid() IS NOT NULL
     AND coalesce(current_setting('app.handover_override', true), '') <> '1'
     AND EXISTS (SELECT 1 FROM jobs WHERE bike_id = NEW.id AND type = 'workshop' AND deferred
                 AND status NOT IN ('complete','completed','cancelled')) THEN
    RAISE EXCEPTION 'Finish the postponed workshop jobs before handover, or have an owner/admin give a reason';
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.guard_handover() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS guard_handover ON public.bikes;
CREATE TRIGGER guard_handover BEFORE UPDATE OF status ON public.bikes FOR EACH ROW EXECUTE FUNCTION public.guard_handover();

CREATE OR REPLACE FUNCTION public.change_bike_stage(_bike_id uuid, _status text, _summary text DEFAULT NULL,
  _note text DEFAULT NULL, _photos text[] DEFAULT NULL, _override_reason text DEFAULT NULL,
  _fulfilment_note text DEFAULT NULL, _action text DEFAULT 'stage') RETURNS jsonb
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE _from text; _deferred jsonb; _reason text := nullif(trim(coalesce(_override_reason,'')),'');
BEGIN
  SELECT status::text INTO _from FROM bikes WHERE id = _bike_id FOR UPDATE;
  IF _from IS NULL THEN RAISE EXCEPTION 'Bike not found'; END IF;
  PERFORM _status::bike_status;
  SELECT jsonb_agg(title) INTO _deferred FROM jobs WHERE bike_id = _bike_id AND type = 'workshop' AND deferred
    AND status NOT IN ('complete','completed','cancelled');
  IF _status IN ('collected','delivered') AND _deferred IS NOT NULL THEN
    IF _reason IS NULL OR NOT (public.has_any_role(ARRAY['admin','owner']::user_role[]) OR public.is_super_admin()) THEN
      RAISE EXCEPTION 'Finish % postponed job(s) before handover, or have an owner/admin give a reason', jsonb_array_length(_deferred);
    END IF;
    PERFORM set_config('app.handover_override', '1', true);
  END IF;
  UPDATE bikes SET status = _status::bike_status,
    photos = CASE WHEN coalesce(array_length(_photos,1),0) > 0 THEN coalesce(photos,'{}') || _photos ELSE photos END
   WHERE id = _bike_id;
  PERFORM set_config('app.handover_override', '', true);
  PERFORM public._log_bike(_bike_id, 'status_change', _action, coalesce(_summary, 'Moved to ' || _status),
    jsonb_strip_nulls(jsonb_build_object('from', _from, 'to', _status, 'note', nullif(trim(coalesce(_note,'')),''),
      'deferred_jobs', _deferred, 'deferred_override', CASE WHEN _reason IS NOT NULL AND _deferred IS NOT NULL
        THEN jsonb_build_object('reason', _reason, 'jobs', _deferred) END)));
  IF coalesce(array_length(_photos,1),0) > 0 THEN
    PERFORM public._log_bike(_bike_id, 'photo', 'added', array_length(_photos,1) || ' photo(s) added', jsonb_build_object('count', array_length(_photos,1)));
  END IF;
  IF _status IN ('intake','cleaning','inspection','repair','ready') AND public.current_profile_id() IS NOT NULL THEN
    INSERT INTO fulfilment_events (bike_id, stage, notes, performed_by)
    VALUES (_bike_id, _status::fulfilment_stage, nullif(coalesce(_fulfilment_note, _note),''), public.current_profile_id());
  END IF;
  RETURN jsonb_build_object('from', _from, 'to', _status);
END $$;

-- 5. Settings validation -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_app_setting() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE _k text := split_part(NEW.key, ':', 1); _ch text;
BEGIN
  IF _k = 'default_delivery_charge' THEN
    IF jsonb_typeof(NEW.value) <> 'number' OR (NEW.value #>> '{}')::numeric < 0 OR (NEW.value #>> '{}')::numeric > 10000 THEN
      RAISE EXCEPTION 'Delivery charge must be a number between 0 and 10,000';
    END IF;
  ELSIF _k = 'vat_registered' THEN
    IF jsonb_typeof(NEW.value) <> 'boolean' THEN RAISE EXCEPTION 'VAT registered must be yes or no'; END IF;
  ELSIF _k = 'bike_reference_prefix' THEN
    IF jsonb_typeof(NEW.value) <> 'string' OR (NEW.value #>> '{}') !~ '^[A-Za-z0-9]{1,6}$' THEN
      RAISE EXCEPTION 'Bike reference prefix must be 1 to 6 letters or numbers';
    END IF;
  ELSIF _k = 'listing_channels' AND NEW.value ? 'markups' THEN
    FOR _ch IN SELECT jsonb_object_keys(NEW.value->'markups') LOOP
      IF coalesce((NEW.value->'markups'->_ch->>'pct')::numeric, 0) NOT BETWEEN -50 AND 300 THEN
        RAISE EXCEPTION 'Mark-up for % must be between -50%% and 300%%', _ch;
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS validate_app_setting ON public.app_settings;
CREATE TRIGGER validate_app_setting BEFORE INSERT OR UPDATE ON public.app_settings FOR EACH ROW EXECUTE FUNCTION public.validate_app_setting();

REVOKE EXECUTE ON FUNCTION public._log_bike(uuid,text,text,text,jsonb), public._strip_to_stock(uuid,text,text,text,text,numeric) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.record_bike_sale(jsonb), public.record_part_sale(uuid,numeric,text,boolean,text,date),
  public.fit_stock_part(jsonb), public.remove_slot_part(jsonb), public.strip_component(jsonb), public.break_bike(uuid,jsonb),
  public.change_bike_stage(uuid,text,text,text,text[],text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_bike_sale(jsonb), public.record_part_sale(uuid,numeric,text,boolean,text,date),
  public.fit_stock_part(jsonb), public.remove_slot_part(jsonb), public.strip_component(jsonb), public.break_bike(uuid,jsonb),
  public.change_bike_stage(uuid,text,text,text,text[],text,text,text), public._log_bike(uuid,text,text,text,jsonb),
  public._strip_to_stock(uuid,text,text,text,text,numeric), public.current_profile_id() TO authenticated;