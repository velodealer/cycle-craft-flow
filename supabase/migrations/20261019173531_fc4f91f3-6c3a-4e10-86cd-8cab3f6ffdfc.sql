CREATE TABLE public.invoice_counters (
  business_id uuid PRIMARY KEY REFERENCES public.businesses(id) ON DELETE CASCADE,
  prefix text NOT NULL DEFAULT 'INV-',
  next_number bigint NOT NULL DEFAULT 1,
  pad integer NOT NULL DEFAULT 6,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.invoice_counters TO authenticated;
GRANT ALL ON public.invoice_counters TO service_role;
ALTER TABLE public.invoice_counters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Dealership reads own invoice counter" ON public.invoice_counters
  FOR SELECT TO authenticated USING (business_id = public.current_business_id() OR public.is_super_admin());

DROP FUNCTION IF EXISTS public.next_invoice_number();
CREATE FUNCTION public.next_invoice_number(_business_id uuid DEFAULT NULL)
RETURNS text LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_bid uuid;
  v_row public.invoice_counters%ROWTYPE;
BEGIN
  -- Signed-in users can only number invoices for their own dealership.
  IF auth.uid() IS NOT NULL AND NOT public.is_super_admin() THEN
    v_bid := public.current_business_id();
  ELSE
    v_bid := COALESCE(_business_id, public.current_business_id());
  END IF;
  IF v_bid IS NOT NULL THEN
    UPDATE public.invoice_counters SET next_number = next_number + 1, updated_at = now()
      WHERE business_id = v_bid RETURNING * INTO v_row;
    IF FOUND THEN
      RETURN v_row.prefix || LPAD((v_row.next_number - 1)::text, v_row.pad, '0');
    END IF;
  END IF;
  RETURN 'INV-' || LPAD(nextval('public.invoice_number_seq')::text, 6, '0');
END $$;
GRANT EXECUTE ON FUNCTION public.next_invoice_number(uuid) TO authenticated, service_role;

INSERT INTO public.invoice_counters (business_id, prefix, next_number, pad)
VALUES ('3eb6de56-eb88-4836-b854-6891f01dce67', 'BPS-INV-', 7200, 6);