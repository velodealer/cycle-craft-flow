ALTER TABLE public.jobs
ADD COLUMN inspection_fault_id uuid REFERENCES public.inspection_faults(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX jobs_inspection_fault_id_unique
ON public.jobs (inspection_fault_id)
WHERE inspection_fault_id IS NOT NULL;