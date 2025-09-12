-- Create enums for various status and type fields
CREATE TYPE public.user_role AS ENUM ('admin', 'mechanic', 'detailer', 'owner', 'accountant');
CREATE TYPE public.bike_status AS ENUM ('intake', 'cleaning', 'inspection', 'pending_approval', 'repair', 'ready', 'listed', 'sold');
CREATE TYPE public.bike_source AS ENUM ('owned', 'customer_consignment');
CREATE TYPE public.finance_scheme AS ENUM ('vat_qualifying', 'margin_scheme', 'commercial_vat');
CREATE TYPE public.part_type AS ENUM ('secondhand_bought', 'secondhand_stripped', 'new_resale', 'new_fitted');
CREATE TYPE public.stock_status AS ENUM ('in_stock', 'reserved', 'sold', 'damaged');
CREATE TYPE public.job_type AS ENUM ('workshop', 'detailing');
CREATE TYPE public.invoice_type AS ENUM ('sale', 'service', 'detailing');
CREATE TYPE public.invoice_status AS ENUM ('draft', 'issued', 'paid', 'overdue', 'cancelled');
CREATE TYPE public.fulfilment_stage AS ENUM ('intake', 'cleaning', 'inspection', 'repair', 'ready');

-- Create profiles table for user management
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'mechanic',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create external_owners table
CREATE TABLE public.external_owners (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create bikes table
CREATE TABLE public.bikes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  frame_number TEXT UNIQUE,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  year INTEGER,
  intake_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  source bike_source NOT NULL DEFAULT 'owned',
  status bike_status NOT NULL DEFAULT 'intake',
  owner_id UUID REFERENCES public.profiles(id),
  external_owner_id UUID REFERENCES public.external_owners(id),
  purchase_price DECIMAL(10,2),
  asking_price DECIMAL(10,2),
  sale_price DECIMAL(10,2),
  finance_scheme finance_scheme NOT NULL DEFAULT 'margin_scheme',
  description TEXT,
  condition_notes TEXT,
  photos TEXT[], -- Array of photo URLs
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT owner_check CHECK (
    (owner_id IS NOT NULL AND external_owner_id IS NULL) OR 
    (owner_id IS NULL AND external_owner_id IS NOT NULL) OR
    (owner_id IS NULL AND external_owner_id IS NULL AND source = 'owned')
  )
);

-- Create parts table
CREATE TABLE public.parts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type part_type NOT NULL,
  brand TEXT,
  description TEXT NOT NULL,
  part_number TEXT,
  cost_price DECIMAL(10,2),
  sale_price DECIMAL(10,2),
  stock_status stock_status NOT NULL DEFAULT 'in_stock',
  quantity INTEGER NOT NULL DEFAULT 1,
  bike_id UUID REFERENCES public.bikes(id), -- For parts fitted to bikes
  stripped_from_bike_id UUID REFERENCES public.bikes(id), -- For parts stripped from bikes
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create jobs table
CREATE TABLE public.jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bike_id UUID NOT NULL REFERENCES public.bikes(id) ON DELETE CASCADE,
  type job_type NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  estimated_cost DECIMAL(10,2),
  actual_cost DECIMAL(10,2),
  assigned_to UUID REFERENCES public.profiles(id),
  status TEXT NOT NULL DEFAULT 'pending',
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create invoices table
CREATE TABLE public.invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_number TEXT UNIQUE NOT NULL,
  job_id UUID REFERENCES public.jobs(id),
  bike_id UUID REFERENCES public.bikes(id),
  customer_id UUID REFERENCES public.profiles(id),
  external_customer_id UUID REFERENCES public.external_owners(id),
  type invoice_type NOT NULL,
  total DECIMAL(10,2) NOT NULL,
  vat_rate DECIMAL(5,2) NOT NULL DEFAULT 20.00,
  net DECIMAL(10,2) NOT NULL,
  gross DECIMAL(10,2) NOT NULL,
  status invoice_status NOT NULL DEFAULT 'draft',
  issued_at TIMESTAMP WITH TIME ZONE,
  due_date DATE,
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create fulfilment_events table
CREATE TABLE public.fulfilment_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bike_id UUID NOT NULL REFERENCES public.bikes(id) ON DELETE CASCADE,
  stage fulfilment_stage NOT NULL,
  notes TEXT,
  performed_by UUID NOT NULL REFERENCES public.profiles(id),
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_owners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bikes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fulfilment_events ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for profiles
CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Admins can update all profiles" ON public.profiles FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin')
);
CREATE POLICY "System can insert profiles" ON public.profiles FOR INSERT WITH CHECK (true);

-- Create RLS policies for external_owners
CREATE POLICY "Staff can manage external owners" ON public.external_owners FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role IN ('admin', 'accountant'))
);

-- Create RLS policies for bikes
CREATE POLICY "Staff can view all bikes" ON public.bikes FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role IN ('admin', 'mechanic', 'detailer', 'accountant'))
);
CREATE POLICY "Owners can view their bikes" ON public.bikes FOR SELECT USING (
  owner_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
);
CREATE POLICY "Staff can manage bikes" ON public.bikes FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role IN ('admin', 'mechanic', 'accountant'))
);

-- Create RLS policies for parts
CREATE POLICY "Staff can manage parts" ON public.parts FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role IN ('admin', 'mechanic', 'accountant'))
);

-- Create RLS policies for jobs
CREATE POLICY "Staff can view jobs" ON public.jobs FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role IN ('admin', 'mechanic', 'detailer', 'accountant'))
);
CREATE POLICY "Staff can manage jobs" ON public.jobs FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role IN ('admin', 'mechanic', 'detailer'))
);

-- Create RLS policies for invoices
CREATE POLICY "Staff can manage invoices" ON public.invoices FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role IN ('admin', 'accountant'))
);

-- Create RLS policies for fulfilment_events
CREATE POLICY "Staff can view fulfilment events" ON public.fulfilment_events FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role IN ('admin', 'mechanic', 'detailer', 'accountant'))
);
CREATE POLICY "Staff can create fulfilment events" ON public.fulfilment_events FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role IN ('admin', 'mechanic', 'detailer'))
);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_external_owners_updated_at BEFORE UPDATE ON public.external_owners FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_bikes_updated_at BEFORE UPDATE ON public.bikes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_parts_updated_at BEFORE UPDATE ON public.parts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_jobs_updated_at BEFORE UPDATE ON public.jobs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    NEW.email,
    'mechanic'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for new user registration
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create indexes for better performance
CREATE INDEX idx_bikes_status ON public.bikes(status);
CREATE INDEX idx_bikes_owner ON public.bikes(owner_id);
CREATE INDEX idx_bikes_external_owner ON public.bikes(external_owner_id);
CREATE INDEX idx_jobs_bike ON public.jobs(bike_id);
CREATE INDEX idx_jobs_assigned_to ON public.jobs(assigned_to);
CREATE INDEX idx_fulfilment_events_bike ON public.fulfilment_events(bike_id);
CREATE INDEX idx_fulfilment_events_timestamp ON public.fulfilment_events(timestamp);
CREATE INDEX idx_parts_bike ON public.parts(bike_id);
CREATE INDEX idx_invoices_customer ON public.invoices(customer_id);
CREATE INDEX idx_invoices_status ON public.invoices(status);