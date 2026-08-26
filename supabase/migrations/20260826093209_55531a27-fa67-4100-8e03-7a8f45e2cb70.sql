CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read app settings"
  ON public.app_settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert app settings"
  ON public.app_settings FOR INSERT TO authenticated
  WITH CHECK (public.has_role('admin'::user_role));

CREATE POLICY "Admins can update app settings"
  ON public.app_settings FOR UPDATE TO authenticated
  USING (public.has_role('admin'::user_role))
  WITH CHECK (public.has_role('admin'::user_role));

CREATE POLICY "Admins can delete app settings"
  ON public.app_settings FOR DELETE TO authenticated
  USING (public.has_role('admin'::user_role));

CREATE TRIGGER update_app_settings_updated_at
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.app_settings (key, value)
VALUES ('bike_reference_prefix', '"BWC"'::jsonb)
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.bikes ADD COLUMN IF NOT EXISTS reference text;
CREATE UNIQUE INDEX IF NOT EXISTS bikes_reference_uk ON public.bikes (reference);

CREATE OR REPLACE FUNCTION public.generate_bike_reference(_make text, _serial text, _bike_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefix text;
  v_brand text;
  v_suffix text;
BEGIN
  SELECT COALESCE(value #>> '{}', 'BWC') INTO v_prefix
  FROM public.app_settings WHERE key = 'bike_reference_prefix';
  v_prefix := UPPER(REGEXP_REPLACE(COALESCE(v_prefix, 'BWC'), '[^A-Za-z0-9]', '', 'g'));
  IF v_prefix = '' THEN v_prefix := 'BWC'; END IF;
  v_prefix := LEFT(v_prefix, 6);

  v_brand := UPPER(REGEXP_REPLACE(COALESCE(_make, ''), '[^A-Za-z]', '', 'g'));
  v_brand := RPAD(LEFT(v_brand, 3), 3, 'X');

  v_suffix := UPPER(REGEXP_REPLACE(COALESCE(NULLIF(TRIM(COALESCE(_serial, '')), ''), REPLACE(_bike_id::text, '-', '')), '[^A-Za-z0-9]', '', 'g'));
  v_suffix := RIGHT(v_suffix, 4);
  IF LENGTH(v_suffix) < 4 THEN
    v_suffix := LPAD(v_suffix, 4, '0');
  END IF;

  RETURN v_prefix || '-' || v_brand || '-' || v_suffix;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_bike_reference()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_base text;
  v_candidate text;
  v_n int := 1;
BEGIN
  IF NEW.reference IS NOT NULL AND NEW.reference <> '' THEN
    RETURN NEW;
  END IF;

  v_base := public.generate_bike_reference(NEW.make, NEW.serial_number, NEW.id);
  v_candidate := v_base;

  WHILE EXISTS (SELECT 1 FROM public.bikes WHERE reference = v_candidate) LOOP
    v_n := v_n + 1;
    v_candidate := v_base || '-' || v_n::text;
  END LOOP;

  NEW.reference := v_candidate;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_bike_reference_trigger ON public.bikes;
CREATE TRIGGER set_bike_reference_trigger
  BEFORE INSERT ON public.bikes
  FOR EACH ROW EXECUTE FUNCTION public.set_bike_reference();

DO $$
DECLARE
  r record;
  v_base text;
  v_candidate text;
  v_n int;
BEGIN
  FOR r IN SELECT id, make, serial_number FROM public.bikes WHERE reference IS NULL ORDER BY created_at LOOP
    v_base := public.generate_bike_reference(r.make, r.serial_number, r.id);
    v_candidate := v_base;
    v_n := 1;
    WHILE EXISTS (SELECT 1 FROM public.bikes WHERE reference = v_candidate) LOOP
      v_n := v_n + 1;
      v_candidate := v_base || '-' || v_n::text;
    END LOOP;
    UPDATE public.bikes SET reference = v_candidate WHERE id = r.id;
  END LOOP;
END $$;