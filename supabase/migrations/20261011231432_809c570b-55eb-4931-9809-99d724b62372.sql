CREATE OR REPLACE FUNCTION public.close_detailing_jobs_past_cleaning()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status::text NOT IN ('pending_intake','awaiting_collection','collection_in_progress','in_transit','intake','cleaning') THEN
    UPDATE public.jobs
       SET status = 'complete', completed_at = COALESCE(completed_at, now())
     WHERE bike_id = NEW.id AND type = 'detailing'
       AND status NOT IN ('complete','completed','cancelled');
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS close_detailing_jobs_past_cleaning ON public.bikes;
CREATE TRIGGER close_detailing_jobs_past_cleaning AFTER UPDATE OF status ON public.bikes
FOR EACH ROW EXECUTE FUNCTION public.close_detailing_jobs_past_cleaning();