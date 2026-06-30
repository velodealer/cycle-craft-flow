import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Range } from '@/lib/reports';

export type ReportsData = {
  bikes: any[];
  parts: any[];
  invoices: any[];
  jobs: any[];
};

export function useReportsData(range: Range) {
  const [data, setData] = useState<ReportsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const [bikesRes, partsRes, invoicesRes, jobsRes] = await Promise.all([
          supabase
            .from('bikes')
            .select('id, make, model, status, intake_date, purchase_price, purchase_cost, collection_cost, delivery_cost, asking_price, sale_price, created_at, updated_at'),
          supabase
            .from('parts')
            .select('id, type, description, brand, cost_price, sale_price, stock_status, quantity, bike_id, created_at, updated_at'),
          supabase
            .from('invoices')
            .select('id, type, status, gross, net, total, issued_at, paid_at, bike_id, created_at'),
          supabase
            .from('jobs')
            .select('id, bike_id, actual_cost, estimated_cost, status, created_at, completed_at'),
        ]);
        if (cancelled) return;
        const err = bikesRes.error || partsRes.error || invoicesRes.error || jobsRes.error;
        if (err) throw err;
        setData({
          bikes: bikesRes.data || [],
          parts: partsRes.data || [],
          invoices: invoicesRes.data || [],
          jobs: jobsRes.data || [],
        });
      } catch (e: any) {
        if (!cancelled) setError(e.message || 'Failed to load report data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [reloadKey]);

  // Note: data is fetched once and re-sliced per section by range; the hook
  // returns range so consumers can memoise their own filtering.
  return { data, loading, error, range, reload: () => setReloadKey((k) => k + 1) };
}
