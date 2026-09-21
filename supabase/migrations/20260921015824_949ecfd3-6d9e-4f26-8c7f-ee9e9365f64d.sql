CREATE TABLE public.business_subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL UNIQUE REFERENCES public.businesses(id) ON DELETE CASCADE,
  plan_name text NOT NULL DEFAULT 'Starter',
  price numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'GBP',
  billing_period text NOT NULL DEFAULT 'monthly',
  seats integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'trialling',
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_subscriptions TO authenticated;
GRANT ALL ON public.business_subscriptions TO service_role;

ALTER TABLE public.business_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins manage subscriptions"
ON public.business_subscriptions FOR ALL
TO authenticated
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

CREATE TRIGGER update_business_subscriptions_updated_at
BEFORE UPDATE ON public.business_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Platform overview
CREATE OR REPLACE FUNCTION public.admin_platform_overview()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'not authorised';
  END IF;

  SELECT jsonb_build_object(
    'total_businesses', (SELECT count(*) FROM businesses),
    'active_businesses', (SELECT count(*) FROM businesses WHERE status = 'active'),
    'pending_businesses', (SELECT count(*) FROM businesses WHERE status = 'pending'),
    'suspended_businesses', (SELECT count(*) FROM businesses WHERE status = 'suspended'),
    'new_businesses_30d', (SELECT count(*) FROM businesses WHERE created_at > now() - interval '30 days'),
    'total_users', (SELECT count(*) FROM profiles),
    'new_users_30d', (SELECT count(*) FROM profiles WHERE created_at > now() - interval '30 days'),
    'total_bikes', (SELECT count(*) FROM bikes),
    'bikes_sold_30d', (SELECT count(*) FROM bikes WHERE sold_at > now() - interval '30 days'),
    'mrr', (
      SELECT COALESCE(SUM(CASE WHEN billing_period = 'yearly' THEN price / 12 ELSE price END), 0)
      FROM business_subscriptions
      WHERE status IN ('active', 'trialling')
    ),
    'paying_subscriptions', (SELECT count(*) FROM business_subscriptions WHERE status = 'active'),
    'signups_by_month', (
      SELECT COALESCE(jsonb_agg(m ORDER BY m->>'month'), '[]'::jsonb)
      FROM (
        SELECT jsonb_build_object(
          'month', to_char(date_trunc('month', created_at), 'YYYY-MM'),
          'count', count(*)
        ) AS m
        FROM businesses
        WHERE created_at > now() - interval '12 months'
        GROUP BY date_trunc('month', created_at)
      ) s
    )
  ) INTO result;

  RETURN result;
END;
$$;

-- Per-dealership stats
CREATE OR REPLACE FUNCTION public.admin_dealership_stats(_from timestamptz DEFAULT (now() - interval '30 days'), _to timestamptz DEFAULT now())
RETURNS TABLE (
  business_id uuid,
  business_name text,
  contact_email text,
  status text,
  created_at timestamptz,
  users_count bigint,
  bikes_total bigint,
  bikes_in_stock bigint,
  bikes_added bigint,
  bikes_sold bigint,
  sale_value numeric,
  jobs_completed bigint,
  last_activity timestamptz,
  plan_name text,
  subscription_status text,
  price numeric,
  billing_period text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'not authorised';
  END IF;

  RETURN QUERY
  SELECT
    b.id,
    b.name,
    b.contact_email,
    b.status,
    b.created_at,
    (SELECT count(*) FROM profiles p WHERE p.business_id = b.id),
    (SELECT count(*) FROM bikes bk WHERE bk.business_id = b.id),
    (SELECT count(*) FROM bikes bk WHERE bk.business_id = b.id AND bk.status NOT IN ('sold', 'delivered', 'split_for_parts')),
    (SELECT count(*) FROM bikes bk WHERE bk.business_id = b.id AND bk.created_at BETWEEN _from AND _to),
    (SELECT count(*) FROM bikes bk WHERE bk.business_id = b.id AND bk.sold_at BETWEEN _from AND _to),
    (SELECT COALESCE(SUM(bk.sale_price), 0) FROM bikes bk WHERE bk.business_id = b.id AND bk.sold_at BETWEEN _from AND _to),
    (SELECT count(*) FROM jobs j WHERE j.business_id = b.id AND j.completed_at BETWEEN _from AND _to),
    GREATEST(
      COALESCE((SELECT max(bk.updated_at) FROM bikes bk WHERE bk.business_id = b.id), b.created_at),
      COALESCE((SELECT max(j.updated_at) FROM jobs j WHERE j.business_id = b.id), b.created_at)
    ),
    s.plan_name,
    s.status,
    s.price,
    s.billing_period
  FROM businesses b
  LEFT JOIN business_subscriptions s ON s.business_id = b.id
  ORDER BY b.created_at;
END;
$$;

-- Integration health
CREATE OR REPLACE FUNCTION public.admin_integration_health()
RETURNS TABLE (
  business_id uuid,
  business_name text,
  integration text,
  connected boolean,
  status text,
  last_error text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'not authorised';
  END IF;

  RETURN QUERY
  SELECT b.id, b.name, i.name, i.is_active, CASE WHEN i.is_active THEN 'connected' ELSE 'inactive' END, NULL::text
  FROM businesses b
  JOIN integrations i ON i.business_id = b.id
  UNION ALL
  SELECT b.id, b.name, 'cycle_courier', c.status = 'connected', c.status, c.last_error
  FROM businesses b
  JOIN cycle_courier_connections c ON c.business_id = b.id
  UNION ALL
  SELECT b.id, b.name, 'inspectabike', ia.status = 'connected', ia.status, ia.last_error
  FROM businesses b
  JOIN inspectabike_connections ia ON ia.business_id = b.id;
END;
$$;