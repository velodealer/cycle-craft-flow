-- Drop all existing policies first
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "System can insert profiles" ON public.profiles;

-- Create profiles policies
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

-- Drop and recreate bikes policies
DROP POLICY IF EXISTS "Staff can view all bikes" ON public.bikes;
DROP POLICY IF EXISTS "Admin and mechanics can manage bikes" ON public.bikes;
DROP POLICY IF EXISTS "Owners can view their bikes" ON public.bikes;

CREATE POLICY "Staff can view all bikes" ON public.bikes
FOR SELECT USING (public.has_any_role(ARRAY['admin'::user_role, 'mechanic'::user_role, 'detailer'::user_role, 'accountant'::user_role]));

CREATE POLICY "Admin and mechanics can manage bikes" ON public.bikes
FOR ALL USING (public.has_any_role(ARRAY['admin'::user_role, 'mechanic'::user_role]));

CREATE POLICY "Owners can view their bikes" ON public.bikes
FOR SELECT USING (
  public.has_role('owner'::user_role) AND 
  (owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()) OR
   external_owner_id IN (SELECT id FROM external_owners WHERE email = (SELECT email FROM profiles WHERE user_id = auth.uid())))
);

-- Drop and recreate jobs policies
DROP POLICY IF EXISTS "Staff can view jobs" ON public.jobs;
DROP POLICY IF EXISTS "Mechanics can manage workshop jobs" ON public.jobs;
DROP POLICY IF EXISTS "Detailers can manage detailing jobs" ON public.jobs;

CREATE POLICY "Staff can view jobs" ON public.jobs
FOR SELECT USING (public.has_any_role(ARRAY['admin'::user_role, 'mechanic'::user_role, 'detailer'::user_role, 'accountant'::user_role]));

CREATE POLICY "Mechanics can manage workshop jobs" ON public.jobs
FOR ALL USING (
  public.has_any_role(ARRAY['admin'::user_role, 'mechanic'::user_role]) AND type = 'workshop'::job_type OR
  public.has_role('admin'::user_role)
);

CREATE POLICY "Detailers can manage detailing jobs" ON public.jobs
FOR ALL USING (
  public.has_any_role(ARRAY['admin'::user_role, 'detailer'::user_role]) AND type = 'detailing'::job_type OR
  public.has_role('admin'::user_role)
);

-- Drop and recreate parts policies
DROP POLICY IF EXISTS "Staff can view parts" ON public.parts;
DROP POLICY IF EXISTS "Admin and mechanics can manage parts" ON public.parts;

CREATE POLICY "Staff can view parts" ON public.parts
FOR SELECT USING (public.has_any_role(ARRAY['admin'::user_role, 'mechanic'::user_role, 'detailer'::user_role, 'accountant'::user_role]));

CREATE POLICY "Admin and mechanics can manage parts" ON public.parts
FOR ALL USING (public.has_any_role(ARRAY['admin'::user_role, 'mechanic'::user_role]));

-- Drop and recreate invoices policies
DROP POLICY IF EXISTS "Staff can view invoices" ON public.invoices;
DROP POLICY IF EXISTS "Admin and accountants can manage invoices" ON public.invoices;

CREATE POLICY "Staff can view invoices" ON public.invoices
FOR SELECT USING (public.has_any_role(ARRAY['admin'::user_role, 'mechanic'::user_role, 'detailer'::user_role, 'accountant'::user_role, 'owner'::user_role]));

CREATE POLICY "Admin and accountants can manage invoices" ON public.invoices
FOR ALL USING (public.has_any_role(ARRAY['admin'::user_role, 'accountant'::user_role]));

-- Drop and recreate fulfilment_events policies
DROP POLICY IF EXISTS "Staff can view fulfilment events" ON public.fulfilment_events;
DROP POLICY IF EXISTS "Staff can create fulfilment events" ON public.fulfilment_events;

CREATE POLICY "Staff can view fulfilment events" ON public.fulfilment_events
FOR SELECT USING (public.has_any_role(ARRAY['admin'::user_role, 'mechanic'::user_role, 'detailer'::user_role, 'accountant'::user_role, 'owner'::user_role]));

CREATE POLICY "Staff can create fulfilment events" ON public.fulfilment_events
FOR INSERT WITH CHECK (public.has_any_role(ARRAY['admin'::user_role, 'mechanic'::user_role, 'detailer'::user_role]));

-- Drop and recreate external_owners policies
DROP POLICY IF EXISTS "Staff can view external owners" ON public.external_owners;
DROP POLICY IF EXISTS "Admin and accountants can manage external owners" ON public.external_owners;

CREATE POLICY "Staff can view external owners" ON public.external_owners
FOR SELECT USING (public.has_any_role(ARRAY['admin'::user_role, 'accountant'::user_role, 'mechanic'::user_role]));

CREATE POLICY "Admin and accountants can manage external owners" ON public.external_owners
FOR ALL USING (public.has_any_role(ARRAY['admin'::user_role, 'accountant'::user_role]));