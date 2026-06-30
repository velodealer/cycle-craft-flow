import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type DashboardCounts = {
  bikes: number | null;
  parts: number | null;
  jobs: number | null;
  invoices: number | null;
  customers: number | null;
};

const ACTIVE_BIKE_STATUSES = [
  'pending_intake', 'intake', 'cleaning', 'inspection',
  'repair', 'ready', 'listed', 'in_stock',
];
const OUTSTANDING_INVOICE_STATUSES = ['draft', 'issued', 'overdue'];

export function useDashboardCounts() {
  const [counts, setCounts] = useState<DashboardCounts>({
    bikes: null, parts: null, jobs: null, invoices: null, customers: null,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [bikes, parts, jobs, invoices, ownerProfiles, externalOwners] = await Promise.all([
        supabase.from('bikes').select('id', { count: 'exact', head: true }).in('status', ACTIVE_BIKE_STATUSES as any),
        supabase.from('parts').select('id', { count: 'exact', head: true }).eq('stock_status', 'in_stock').is('bike_id', null),
        supabase.from('jobs').select('id', { count: 'exact', head: true }).not('status', 'in', '(completed,cancelled)'),
        supabase.from('invoices').select('id', { count: 'exact', head: true }).in('status', OUTSTANDING_INVOICE_STATUSES as any),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'owner'),
        supabase.from('external_owners').select('id', { count: 'exact', head: true }),
      ]);
      if (cancelled) return;
      setCounts({
        bikes: bikes.count ?? 0,
        parts: parts.count ?? 0,
        jobs: jobs.count ?? 0,
        invoices: invoices.count ?? 0,
        customers: (ownerProfiles.count ?? 0) + (externalOwners.count ?? 0),
      });
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  return { counts, loading };
}
