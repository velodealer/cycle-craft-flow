-- Create storage buckets for file uploads
INSERT INTO storage.buckets (id, name, public) VALUES 
  ('bike-photos', 'bike-photos', true),
  ('job-photos', 'job-photos', true),
  ('fulfilment-photos', 'fulfilment-photos', true);

-- Create policies for bike photos
CREATE POLICY "Anyone can view bike photos" ON storage.objects
FOR SELECT USING (bucket_id = 'bike-photos');

CREATE POLICY "Staff can upload bike photos" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'bike-photos' AND
  has_any_role(ARRAY['admin'::user_role, 'mechanic'::user_role, 'accountant'::user_role])
);

CREATE POLICY "Staff can update bike photos" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'bike-photos' AND
  has_any_role(ARRAY['admin'::user_role, 'mechanic'::user_role, 'accountant'::user_role])
);

CREATE POLICY "Staff can delete bike photos" ON storage.objects
FOR DELETE USING (
  bucket_id = 'bike-photos' AND
  has_any_role(ARRAY['admin'::user_role, 'mechanic'::user_role, 'accountant'::user_role])
);

-- Create policies for job photos
CREATE POLICY "Staff can view job photos" ON storage.objects
FOR SELECT USING (
  bucket_id = 'job-photos' AND
  has_any_role(ARRAY['admin'::user_role, 'mechanic'::user_role, 'detailer'::user_role, 'accountant'::user_role])
);

CREATE POLICY "Staff can upload job photos" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'job-photos' AND
  has_any_role(ARRAY['admin'::user_role, 'mechanic'::user_role, 'detailer'::user_role])
);

CREATE POLICY "Staff can update job photos" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'job-photos' AND
  has_any_role(ARRAY['admin'::user_role, 'mechanic'::user_role, 'detailer'::user_role])
);

CREATE POLICY "Staff can delete job photos" ON storage.objects
FOR DELETE USING (
  bucket_id = 'job-photos' AND
  has_any_role(ARRAY['admin'::user_role, 'mechanic'::user_role, 'detailer'::user_role])
);

-- Create policies for fulfilment photos  
CREATE POLICY "Staff can view fulfilment photos" ON storage.objects
FOR SELECT USING (
  bucket_id = 'fulfilment-photos' AND
  has_any_role(ARRAY['admin'::user_role, 'mechanic'::user_role, 'detailer'::user_role, 'accountant'::user_role])
);

CREATE POLICY "Staff can upload fulfilment photos" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'fulfilment-photos' AND
  has_any_role(ARRAY['admin'::user_role, 'mechanic'::user_role, 'detailer'::user_role])
);

CREATE POLICY "Staff can update fulfilment photos" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'fulfilment-photos' AND
  has_any_role(ARRAY['admin'::user_role, 'mechanic'::user_role, 'detailer'::user_role])
);

CREATE POLICY "Staff can delete fulfilment photos" ON storage.objects
FOR DELETE USING (
  bucket_id = 'fulfilment-photos' AND
  has_any_role(ARRAY['admin'::user_role, 'mechanic'::user_role, 'detailer'::user_role])
);

-- Add missing fields to bikes table for the user requirements
ALTER TABLE public.bikes 
ADD COLUMN IF NOT EXISTS size text,
ADD COLUMN IF NOT EXISTS colour text,
ADD COLUMN IF NOT EXISTS condition text,
ADD COLUMN IF NOT EXISTS accessories_included text,
ADD COLUMN IF NOT EXISTS listing_description text;

-- Add preferred contact method to external_owners
ALTER TABLE public.external_owners
ADD COLUMN IF NOT EXISTS preferred_contact text DEFAULT 'email';

-- Add photos columns to jobs table  
ALTER TABLE public.jobs
ADD COLUMN IF NOT EXISTS photos_before text[],
ADD COLUMN IF NOT EXISTS photos_after text[];