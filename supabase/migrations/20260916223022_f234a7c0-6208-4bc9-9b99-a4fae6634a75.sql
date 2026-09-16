CREATE TABLE public.blog_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  excerpt text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  cover_image_url text,
  tags text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'draft',
  author_name text NOT NULL DEFAULT 'VeloDealer',
  published_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.blog_posts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blog_posts TO authenticated;
GRANT ALL ON public.blog_posts TO service_role;
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Published posts are public" ON public.blog_posts FOR SELECT USING (status = 'published');
CREATE POLICY "Admins read all posts" ON public.blog_posts FOR SELECT TO authenticated USING (public.has_any_role(ARRAY['admin','owner']::user_role[]));
CREATE POLICY "Admins manage posts" ON public.blog_posts FOR ALL TO authenticated USING (public.has_any_role(ARRAY['admin','owner']::user_role[])) WITH CHECK (public.has_any_role(ARRAY['admin','owner']::user_role[]));
CREATE TRIGGER update_blog_posts_updated_at BEFORE UPDATE ON public.blog_posts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.job_openings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  location text NOT NULL DEFAULT '',
  employment_type text NOT NULL DEFAULT '',
  summary text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  is_open boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.job_openings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_openings TO authenticated;
GRANT ALL ON public.job_openings TO service_role;
ALTER TABLE public.job_openings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Open roles are public" ON public.job_openings FOR SELECT USING (is_open = true);
CREATE POLICY "Admins read all roles" ON public.job_openings FOR SELECT TO authenticated USING (public.has_any_role(ARRAY['admin','owner']::user_role[]));
CREATE POLICY "Admins manage roles" ON public.job_openings FOR ALL TO authenticated USING (public.has_any_role(ARRAY['admin','owner']::user_role[])) WITH CHECK (public.has_any_role(ARRAY['admin','owner']::user_role[]));
CREATE TRIGGER update_job_openings_updated_at BEFORE UPDATE ON public.job_openings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.job_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opening_id uuid REFERENCES public.job_openings(id) ON DELETE SET NULL,
  role_title text NOT NULL,
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  links text,
  cover_note text,
  cv_path text,
  status text NOT NULL DEFAULT 'new',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE, DELETE ON public.job_applications TO authenticated;
GRANT ALL ON public.job_applications TO service_role;
ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read applications" ON public.job_applications FOR SELECT TO authenticated USING (public.has_any_role(ARRAY['admin','owner']::user_role[]));
CREATE POLICY "Admins update applications" ON public.job_applications FOR UPDATE TO authenticated USING (public.has_any_role(ARRAY['admin','owner']::user_role[])) WITH CHECK (public.has_any_role(ARRAY['admin','owner']::user_role[]));
CREATE POLICY "Admins delete applications" ON public.job_applications FOR DELETE TO authenticated USING (public.has_any_role(ARRAY['admin','owner']::user_role[]));
CREATE TRIGGER update_job_applications_updated_at BEFORE UPDATE ON public.job_applications FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  company text,
  subject text NOT NULL,
  message text NOT NULL,
  source text NOT NULL DEFAULT 'contact_form',
  status text NOT NULL DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE, DELETE ON public.support_tickets TO authenticated;
GRANT ALL ON public.support_tickets TO service_role;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read tickets" ON public.support_tickets FOR SELECT TO authenticated USING (public.has_any_role(ARRAY['admin','owner']::user_role[]));
CREATE POLICY "Admins update tickets" ON public.support_tickets FOR UPDATE TO authenticated USING (public.has_any_role(ARRAY['admin','owner']::user_role[])) WITH CHECK (public.has_any_role(ARRAY['admin','owner']::user_role[]));
CREATE POLICY "Admins delete tickets" ON public.support_tickets FOR DELETE TO authenticated USING (public.has_any_role(ARRAY['admin','owner']::user_role[]));
CREATE TRIGGER update_support_tickets_updated_at BEFORE UPDATE ON public.support_tickets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.support_ticket_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  body text NOT NULL,
  sent_by uuid,
  sent_by_name text,
  sent_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.support_ticket_replies TO authenticated;
GRANT ALL ON public.support_ticket_replies TO service_role;
ALTER TABLE public.support_ticket_replies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read replies" ON public.support_ticket_replies FOR SELECT TO authenticated USING (public.has_any_role(ARRAY['admin','owner']::user_role[]));
CREATE POLICY "Admins add replies" ON public.support_ticket_replies FOR INSERT TO authenticated WITH CHECK (public.has_any_role(ARRAY['admin','owner']::user_role[]));

INSERT INTO public.job_openings (slug, title, location, employment_type, summary, description, sort_order) VALUES
('customer-success-manager', 'Customer Success Manager', 'Birmingham, UK / Hybrid', 'Full-time',
 'Own the relationship with our dealers from first onboarding call to long-term growth.',
 'You will be the first person a new dealership meets after signing up. You will run onboarding sessions, migrate their stock into VeloDealer, train mechanics and sales staff on intake, inspections and listings, and stay with them as they grow.

What you will do
- Onboard new dealerships and get their first bikes through the workflow.
- Run training sessions for workshop, sales and admin teams.
- Be the day-to-day contact for questions, feature requests and issues.
- Spot accounts at risk and turn them around.
- Feed customer insight back to the product team.

What we are looking for
- Experience in customer success, account management or retail/workshop operations.
- Comfortable explaining software to people who are not software people.
- Organised, proactive and happy owning your own diary.
- Bonus: you know the cycling trade.', 1),
('software-developer', 'Software Developer', 'Birmingham, UK / Remote', 'Full-time',
 'Build the product end to end — React front end, Postgres data model, and integrations with the trade.',
 'VeloDealer is a full workshop, stock and sales platform for bicycle dealers, with live integrations into accounting, courier, marketplace and inspection systems. You would work across the whole stack.

What you will do
- Build features in React and TypeScript with a clean, fast UI.
- Design Postgres schemas and secure data access.
- Write and maintain integrations (QuickBooks, Shopify, eBay, couriers, inspection partners).
- Keep quality high: sensible tests, good error handling, real-world edge cases.

What we are looking for
- Solid TypeScript and React experience.
- Comfortable with SQL and relational data modelling.
- Has shipped and maintained third-party API integrations.
- Pragmatic, product-minded and happy in a small team.', 2);