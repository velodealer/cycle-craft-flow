CREATE OR REPLACE FUNCTION public.guard_profile_role_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role
     AND auth.uid() IS NOT NULL
     AND NOT public.is_super_admin()
     AND NOT public.has_any_role(ARRAY['admin','owner']::user_role[]) THEN
    RAISE EXCEPTION 'Only an admin or owner can change staff roles';
  END IF;
  IF NEW.role IS DISTINCT FROM OLD.role AND OLD.user_id = auth.uid() AND NOT public.is_super_admin()
     AND NEW.role NOT IN ('admin','owner') AND OLD.role IN ('admin','owner') THEN
    NULL; -- admins may step themselves down
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS guard_profile_role_change ON public.profiles;
CREATE TRIGGER guard_profile_role_change BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_role_change();
REVOKE EXECUTE ON FUNCTION public.guard_profile_role_change() FROM anon, authenticated;

DROP POLICY IF EXISTS "System can insert profiles" ON public.profiles;