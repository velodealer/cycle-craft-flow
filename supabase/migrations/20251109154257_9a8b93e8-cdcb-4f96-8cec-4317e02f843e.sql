-- Create integrations table for storing third-party API configurations
CREATE TABLE public.integrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  api_key TEXT,
  webhook_secret TEXT,
  is_active BOOLEAN NOT NULL DEFAULT false,
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;

-- Create policies for admin-only access
CREATE POLICY "Admins can view all integrations"
  ON public.integrations
  FOR SELECT
  USING (has_role('admin'));

CREATE POLICY "Admins can insert integrations"
  ON public.integrations
  FOR INSERT
  WITH CHECK (has_role('admin'));

CREATE POLICY "Admins can update integrations"
  ON public.integrations
  FOR UPDATE
  USING (has_role('admin'));

CREATE POLICY "Admins can delete integrations"
  ON public.integrations
  FOR DELETE
  USING (has_role('admin'));

-- Create indexes for better performance
CREATE INDEX idx_integrations_name ON public.integrations(name);
CREATE INDEX idx_integrations_is_active ON public.integrations(is_active);
CREATE INDEX idx_integrations_webhook_secret ON public.integrations(webhook_secret) WHERE webhook_secret IS NOT NULL;

-- Create trigger for automatic updated_at timestamp
CREATE TRIGGER update_integrations_updated_at
  BEFORE UPDATE ON public.integrations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();