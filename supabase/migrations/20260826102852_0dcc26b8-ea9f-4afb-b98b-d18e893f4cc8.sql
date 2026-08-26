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

  v_base := public.generate_bike_reference(
    NEW.make,
    COALESCE(NULLIF(TRIM(COALESCE(NEW.frame_number, '')), ''), NEW.serial_number),
    NEW.id
  );
  v_candidate := v_base;

  WHILE EXISTS (SELECT 1 FROM public.bikes WHERE reference = v_candidate) LOOP
    v_n := v_n + 1;
    v_candidate := v_base || '-' || v_n::text;
  END LOOP;

  NEW.reference := v_candidate;
  RETURN NEW;
END;
$$;