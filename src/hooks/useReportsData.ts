import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Range } from '@/lib/reports';

export type ReportsData = {
  bikes: any[];
  parts: any[];
  invoices: any[];
  jobs: any[];
  events: any[];
  inspections: any[];
  faults: any[];
  bays: any[];
  ebay: any[];
  shopify: any[];
};

const LIMIT = 5000;

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
        const [bikesRes, partsRes, invoicesRes, jobsRes, eventsRes, inspRes, faultsRes, baysRes, ebayRes, shopifyRes] =
          await Promise.all([
            supabase
              .from('bikes')
              .select('id, reference, make, model, status, intake_date, purchase_price, purchase_cost, collection_cost, delivery_cost, asking_price, sale_price, sold_at, size, colour, condition, bike_type, frame_material, is_electric, spec_values, source, acquired_via, finance_scheme, storage_bay_id, investor_id, created_at, updated_at')
              .limit(LIMIT),
            supabase
              .from('parts')
              .select('id, type, description, brand, cost_price, sale_price, stock_status, quantity, bike_id, storage_bay_id, created_at, updated_at')
              .limit(LIMIT),
            supabase
              .from('invoices')
              .select('id, invoice_number, type, status, gross, net, total, vat_rate, delivery_charge, part_exchange_value, issued_at, due_date, paid_at, bike_id, created_at')
              .limit(LIMIT),
            supabase
              .from('jobs')
              .select('id, bike_id, type, title, actual_cost, estimated_cost, status, assigned_to, created_at, started_at, completed_at')
              .limit(LIMIT),
            supabase
              .from('fulfilment_events')
              .select('id, bike_id, stage, performed_by, timestamp')
              .limit(LIMIT),
            supabase
              .from('inspections')
              .select('id, bike_id, status, has_issues, overall_grade, started_at, completed_at, created_at')
              .limit(LIMIT),
            supabase
              .from('inspection_faults')
              .select('id, bike_id, inspection_id, status, severity, parts_cost, labour_cost, created_at, repaired_at')
              .limit(LIMIT),
            supabase.from('storage_bays').select('id, name, zone, is_active').limit(LIMIT),
            supabase.from('ebay_listings').select('id, bike_id, status, created_at').limit(LIMIT),
            supabase.from('shopify_listings').select('id, bike_id, status, created_at').limit(LIMIT),
          ]);
        if (cancelled) return;
        const err =
          bikesRes.error || partsRes.error || invoicesRes.error || jobsRes.error || eventsRes.error ||
          inspRes.error || faultsRes.error || baysRes.error || ebayRes.error || shopifyRes.error;
        if (err) throw err;
        setData({
          bikes: bikesRes.data || [],
          parts: partsRes.data || [],
          invoices: invoicesRes.data || [],
          jobs: jobsRes.data || [],
          events: eventsRes.data || [],
          inspections: inspRes.data || [],
          faults: faultsRes.data || [],
          bays: baysRes.data || [],
          ebay: ebayRes.data || [],
          shopify: shopifyRes.data || [],
        });
      } catch (e: any) {
        if (!cancelled) setError(e.message || 'Failed to load report data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [reloadKey]);

  // Data is fetched once and re-sliced per section by range so that comparison
  // periods need no extra round trips.
  return { data, loading, error, range, reload: () => setReloadKey((k) => k + 1) };
}
