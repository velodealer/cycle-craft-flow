-- Create bike_collections table
CREATE TABLE bike_collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bike_id uuid NOT NULL REFERENCES bikes(id) ON DELETE CASCADE,
  
  -- Cycle Courier Order Details
  order_id text UNIQUE,
  tracking_number text,
  status text NOT NULL DEFAULT 'pending',
  
  -- Sender Information
  sender_name text NOT NULL,
  sender_email text NOT NULL,
  sender_phone text NOT NULL,
  
  -- Pickup Address
  address_street text NOT NULL,
  address_city text NOT NULL,
  address_postcode text NOT NULL,
  address_country text NOT NULL DEFAULT 'UK',
  
  -- Additional Details
  delivery_instructions text,
  scheduled_date timestamptz,
  
  -- Error Tracking
  error_message text,
  retry_count integer DEFAULT 0,
  
  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

-- Indexes for quick lookups
CREATE INDEX idx_bike_collections_bike_id ON bike_collections(bike_id);
CREATE INDEX idx_bike_collections_order_id ON bike_collections(order_id);
CREATE INDEX idx_bike_collections_status ON bike_collections(status);

-- Enable RLS
ALTER TABLE bike_collections ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Staff can view collections"
  ON bike_collections FOR SELECT
  USING (has_any_role(ARRAY['admin'::user_role, 'mechanic'::user_role, 'accountant'::user_role]));

CREATE POLICY "Staff can manage collections"
  ON bike_collections FOR ALL
  USING (has_any_role(ARRAY['admin'::user_role, 'mechanic'::user_role]));

-- Trigger for updated_at
CREATE TRIGGER update_bike_collections_updated_at
  BEFORE UPDATE ON bike_collections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add new bike statuses for collection workflow
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'bike_status' AND e.enumlabel = 'awaiting_collection') THEN
    ALTER TYPE bike_status ADD VALUE 'awaiting_collection';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'bike_status' AND e.enumlabel = 'collection_in_progress') THEN
    ALTER TYPE bike_status ADD VALUE 'collection_in_progress';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'bike_status' AND e.enumlabel = 'in_transit') THEN
    ALTER TYPE bike_status ADD VALUE 'in_transit';
  END IF;
END $$;