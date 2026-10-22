CREATE TABLE public.data_deletion_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL DEFAULT auth.uid(),
  requester_email text,
  reason text,
  status text NOT NULL DEFAULT 'pending',
  decided_by uuid,
  decided_at timestamptz,
  decision_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.data_deletion_requests TO authenticated;
GRANT ALL ON public.data_deletion_requests TO service_role;
ALTER TABLE public.data_deletion_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Dealer owners/admins see own requests" ON public.data_deletion_requests
  FOR SELECT TO authenticated
  USING (public.is_super_admin() OR (business_id = public.current_business_id() AND public.has_any_role(ARRAY['admin','owner']::user_role[])));
CREATE POLICY "Dealer owners/admins request deletion" ON public.data_deletion_requests
  FOR INSERT TO authenticated
  WITH CHECK (business_id = public.current_business_id() AND requested_by = auth.uid() AND status = 'pending'
    AND public.has_any_role(ARRAY['admin','owner']::user_role[]));
CREATE POLICY "Super admins decide" ON public.data_deletion_requests
  FOR UPDATE TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

CREATE OR REPLACE FUNCTION public.validate_deletion_request() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status NOT IN ('pending','approved','rejected') THEN RAISE EXCEPTION 'Invalid status'; END IF;
  IF TG_OP = 'INSERT' AND EXISTS (SELECT 1 FROM public.data_deletion_requests WHERE business_id = NEW.business_id AND status = 'pending') THEN
    RAISE EXCEPTION 'A deletion request is already waiting for review';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.status <> OLD.status THEN
    NEW.decided_by := auth.uid(); NEW.decided_at := now();
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER validate_deletion_request BEFORE INSERT OR UPDATE ON public.data_deletion_requests
  FOR EACH ROW EXECUTE FUNCTION public.validate_deletion_request();

-- Approving locks the dealership out straight away
CREATE OR REPLACE FUNCTION public.apply_deletion_approval() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status <> 'approved' THEN
    UPDATE public.businesses SET status = 'suspended', updated_at = now() WHERE id = NEW.business_id;
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.apply_deletion_approval() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER apply_deletion_approval AFTER UPDATE ON public.data_deletion_requests
  FOR EACH ROW EXECUTE FUNCTION public.apply_deletion_approval();