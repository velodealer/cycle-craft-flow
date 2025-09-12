-- Fix infinite recursion in RLS policies by creating security definer functions
-- Drop existing problematic policies first
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;

-- Create security definer function to get current user role
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE user_id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE SET search_path = public;

-- Create security definer function to check if user has specific role
CREATE OR REPLACE FUNCTION public.has_role(required_role user_role)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() AND role = required_role
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE SET search_path = public;

-- Create security definer function to check if user has any of multiple roles
CREATE OR REPLACE FUNCTION public.has_any_role(roles user_role[])
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() AND role = ANY(roles)
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE SET search_path = public;

-- Recreate profiles policies without recursion
CREATE POLICY "Users can view their own profile" ON public.profiles
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" ON public.profiles
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all profiles" ON public.profiles
FOR SELECT USING (public.has_role('admin'));

CREATE POLICY "Admins can update all profiles" ON public.profiles
FOR UPDATE USING (public.has_role('admin'));

CREATE POLICY "System can insert profiles" ON public.profiles
FOR INSERT WITH CHECK (true);

-- Update bikes policies to use new functions
DROP POLICY IF EXISTS "Staff can view all bikes" ON public.bikes;
DROP POLICY IF EXISTS "Staff can manage bikes" ON public.bikes;
DROP POLICY IF EXISTS "Owners can view their bikes" ON public.bikes;

CREATE POLICY "Staff can view all bikes" ON public.bikes
FOR SELECT USING (public.has_any_role(ARRAY['admin', 'mechanic', 'detailer', 'accountant']));

CREATE POLICY "Admin and mechanics can manage bikes" ON public.bikes
FOR ALL USING (public.has_any_role(ARRAY['admin', 'mechanic']));

CREATE POLICY "Owners can view their bikes" ON public.bikes
FOR SELECT USING (
  public.has_role('owner') AND 
  (owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()) OR
   external_owner_id IN (SELECT id FROM external_owners WHERE email = (SELECT email FROM profiles WHERE user_id = auth.uid())))
);

-- Update jobs policies
DROP POLICY IF EXISTS "Staff can view jobs" ON public.jobs;
DROP POLICY IF EXISTS "Staff can manage jobs" ON public.jobs;

CREATE POLICY "Staff can view jobs" ON public.jobs
FOR SELECT USING (public.has_any_role(ARRAY['admin', 'mechanic', 'detailer', 'accountant']));

CREATE POLICY "Staff can manage jobs" ON public.jobs
FOR ALL USING (public.has_any_role(ARRAY['admin', 'mechanic', 'detailer']));

-- Update parts policies  
DROP POLICY IF EXISTS "Staff can manage parts" ON public.parts;

CREATE POLICY "Staff can view parts" ON public.parts
FOR SELECT USING (public.has_any_role(ARRAY['admin', 'mechanic', 'detailer', 'accountant']));

CREATE POLICY "Admin and mechanics can manage parts" ON public.parts
FOR ALL USING (public.has_any_role(ARRAY['admin', 'mechanic']));

-- Update invoices policies
DROP POLICY IF EXISTS "Staff can manage invoices" ON public.invoices;

CREATE POLICY "Staff can view invoices" ON public.invoices
FOR SELECT USING (public.has_any_role(ARRAY['admin', 'mechanic', 'detailer', 'accountant', 'owner']));

CREATE POLICY "Admin and accountants can manage invoices" ON public.invoices
FOR ALL USING (public.has_any_role(ARRAY['admin', 'accountant']));

-- Update fulfilment_events policies
DROP POLICY IF EXISTS "Staff can view fulfilment events" ON public.fulfilment_events;
DROP POLICY IF EXISTS "Staff can create fulfilment events" ON public.fulfilment_events;

CREATE POLICY "Staff can view fulfilment events" ON public.fulfilment_events
FOR SELECT USING (public.has_any_role(ARRAY['admin', 'mechanic', 'detailer', 'accountant', 'owner']));

CREATE POLICY "Staff can create fulfilment events" ON public.fulfilment_events
FOR INSERT WITH CHECK (public.has_any_role(ARRAY['admin', 'mechanic', 'detailer']));

-- Update external_owners policies
DROP POLICY IF EXISTS "Staff can manage external owners" ON public.external_owners;

CREATE POLICY "Staff can view external owners" ON public.external_owners
FOR SELECT USING (public.has_any_role(ARRAY['admin', 'accountant', 'mechanic']));

CREATE POLICY "Admin and accountants can manage external owners" ON public.external_owners
FOR ALL USING (public.has_any_role(ARRAY['admin', 'accountant']));