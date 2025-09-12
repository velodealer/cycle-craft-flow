-- Make frame_number nullable in bikes table since it will be set during intake
ALTER TABLE public.bikes ALTER COLUMN frame_number DROP NOT NULL;