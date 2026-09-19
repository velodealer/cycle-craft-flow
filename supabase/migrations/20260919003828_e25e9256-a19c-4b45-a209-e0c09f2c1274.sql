ALTER TABLE public.parts
ADD COLUMN storage_bay_id uuid NULL REFERENCES public.storage_bays(id) ON DELETE SET NULL;

CREATE INDEX parts_storage_bay_id_idx ON public.parts(storage_bay_id);