
-- Columns
ALTER TABLE public.bikes
  ADD COLUMN IF NOT EXISTS investor_id uuid REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS profit_share_pct numeric(5,2),
  ADD COLUMN IF NOT EXISTS purchase_cost numeric(10,2);

CREATE INDEX IF NOT EXISTS idx_bikes_investor_id ON public.bikes(investor_id);

-- Validation trigger
CREATE OR REPLACE FUNCTION public.validate_investor_bike()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.source = 'investor'::bike_source THEN
    IF NEW.investor_id IS NULL THEN
      RAISE EXCEPTION 'Investor bikes require investor_id';
    END IF;
    IF NEW.profit_share_pct IS NULL OR NEW.profit_share_pct < 0 OR NEW.profit_share_pct > 100 THEN
      RAISE EXCEPTION 'Investor bikes require profit_share_pct between 0 and 100';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_investor_bike_trigger ON public.bikes;
CREATE TRIGGER validate_investor_bike_trigger
  BEFORE INSERT OR UPDATE ON public.bikes
  FOR EACH ROW EXECUTE FUNCTION public.validate_investor_bike();

-- Security definer helper
CREATE OR REPLACE FUNCTION public.is_investor_for_bike(_bike_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.bikes
    WHERE id = _bike_id AND investor_id = auth.uid()
  );
$$;

-- RLS: investor read on bikes
DROP POLICY IF EXISTS "Investors can view their bikes" ON public.bikes;
CREATE POLICY "Investors can view their bikes"
  ON public.bikes FOR SELECT
  TO authenticated
  USING (investor_id = auth.uid());

-- Related read policies
DROP POLICY IF EXISTS "Investors can view jobs for their bikes" ON public.jobs;
CREATE POLICY "Investors can view jobs for their bikes"
  ON public.jobs FOR SELECT
  TO authenticated
  USING (public.is_investor_for_bike(bike_id));

DROP POLICY IF EXISTS "Investors can view parts for their bikes" ON public.parts;
CREATE POLICY "Investors can view parts for their bikes"
  ON public.parts FOR SELECT
  TO authenticated
  USING (bike_id IS NOT NULL AND public.is_investor_for_bike(bike_id));

DROP POLICY IF EXISTS "Investors can view collections for their bikes" ON public.bike_collections;
CREATE POLICY "Investors can view collections for their bikes"
  ON public.bike_collections FOR SELECT
  TO authenticated
  USING (public.is_investor_for_bike(bike_id));

DROP POLICY IF EXISTS "Investors can view fulfilment events for their bikes" ON public.fulfilment_events;
CREATE POLICY "Investors can view fulfilment events for their bikes"
  ON public.fulfilment_events FOR SELECT
  TO authenticated
  USING (public.is_investor_for_bike(bike_id));

DROP POLICY IF EXISTS "Investors can view invoices for their bikes" ON public.invoices;
CREATE POLICY "Investors can view invoices for their bikes"
  ON public.invoices FOR SELECT
  TO authenticated
  USING (bike_id IS NOT NULL AND public.is_investor_for_bike(bike_id));
