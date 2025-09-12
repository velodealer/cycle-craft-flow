-- Add checklist field to jobs table for detailing tasks
ALTER TABLE public.jobs ADD COLUMN checklist JSONB DEFAULT NULL;

-- Add comments to clarify the checklist structure
COMMENT ON COLUMN public.jobs.checklist IS 'JSON object containing cleaning checklist items: {wash: boolean, degrease: boolean, drivetrain_clean: boolean, polish_detail: boolean}';