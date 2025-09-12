-- Add new bike statuses for fulfillment workflow
ALTER TYPE bike_status ADD VALUE 'pending_intake';
ALTER TYPE bike_status ADD VALUE 'in_stock';

-- Add fulfillment_type column to bikes table
ALTER TABLE public.bikes ADD COLUMN fulfillment_type TEXT NOT NULL DEFAULT 'fulfilled_by_bps';

-- Add check constraint for fulfillment_type
ALTER TABLE public.bikes ADD CONSTRAINT fulfillment_type_check 
CHECK (fulfillment_type IN ('fulfilled_by_bps', 'stocked_by_me'));

-- Create index for better performance on fulfillment queries
CREATE INDEX idx_bikes_fulfillment_type ON public.bikes(fulfillment_type);
CREATE INDEX idx_bikes_status_fulfillment ON public.bikes(status, fulfillment_type);