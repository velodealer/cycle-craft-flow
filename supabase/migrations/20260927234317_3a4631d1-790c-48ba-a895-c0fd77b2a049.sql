ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS deferred boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deferred_reason text,
  ADD COLUMN IF NOT EXISTS deferred_by uuid,
  ADD COLUMN IF NOT EXISTS deferred_at timestamptz;

CREATE OR REPLACE FUNCTION public.guard_job_deferral()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.deferred)
     OR (TG_OP = 'UPDATE' AND (NEW.deferred IS DISTINCT FROM OLD.deferred OR NEW.deferred_reason IS DISTINCT FROM OLD.deferred_reason)) THEN
    IF auth.uid() IS NOT NULL AND NOT (public.has_any_role(ARRAY['admin','owner']::user_role[]) OR public.is_super_admin()) THEN
      RAISE EXCEPTION 'Only an owner or admin can defer jobs';
    END IF;
    IF NEW.deferred THEN
      IF coalesce(trim(NEW.deferred_reason), '') = '' THEN
        RAISE EXCEPTION 'A reason is required to defer a job';
      END IF;
      NEW.deferred_by := coalesce(auth.uid(), NEW.deferred_by);
      NEW.deferred_at := now();
    ELSE
      NEW.deferred_reason := NULL; NEW.deferred_by := NULL; NEW.deferred_at := NULL;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS jobs_guard_deferral ON public.jobs;
CREATE TRIGGER jobs_guard_deferral BEFORE INSERT OR UPDATE ON public.jobs
FOR EACH ROW EXECUTE FUNCTION public.guard_job_deferral();

CREATE INDEX IF NOT EXISTS jobs_deferred_open_idx ON public.jobs (bike_id) WHERE deferred AND status <> 'complete';