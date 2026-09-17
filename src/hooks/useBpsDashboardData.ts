import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type BpsDashboardData = {
  statusCounts: Record<string, number>;
  enteredToday: Record<string, number>;
  totalInSystem: number;
  soldThisMonth: number;
  soldLast7: number;
  jobsOpen: number;
  jobsWorkshop: number;
  jobsDetailing: number;
  pipeline: { intakeToCleaning: number; cleaningToInspection: number; inspectionToApproval: number };
  revenue: { total: number; avgSalePrice: number; services: number };
  loadedAt: Date;
};

const ACTIVE_STATUSES = [
  'pending_intake', 'intake', 'cleaning', 'inspection',
  'pending_approval', 'repair', 'ready', 'listed',
  'awaiting_collection', 'collection_in_progress', 'in_transit', 'in_stock',
];

const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const startOfMonth = () => { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d; };
const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return d; };

export function useBpsDashboardData() {
  const [data, setData] = useState<BpsDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const monthStart = startOfMonth().toISOString();
      const today = startOfToday().toISOString();
      const since30 = daysAgo(30).toISOString();
      const since7 = daysAgo(7).toISOString();

      const [bikesRes, jobsRes, eventsRes, invoicesRes] = await Promise.all([
        supabase.from('bikes').select('id, status, sold_at, updated_at, sale_price, intake_date, created_at'),
        supabase.from('jobs').select('id, type, status'),
        supabase.from('fulfilment_events').select('stage, timestamp').gte('timestamp', since30),
        supabase.from('invoices').select('type, gross, total, paid_at, status').eq('status', 'paid').gte('paid_at', monthStart),
      ]);

      const firstError = bikesRes.error || jobsRes.error || eventsRes.error || invoicesRes.error;
      if (firstError) throw firstError;

      const bikes = (bikesRes.data || []) as any[];
      const jobs = (jobsRes.data || []) as any[];
      const events = (eventsRes.data || []) as any[];
      const invoices = (invoicesRes.data || []) as any[];

      const statusCounts: Record<string, number> = {};
      for (const b of bikes) statusCounts[b.status] = (statusCounts[b.status] || 0) + 1;

      const enteredToday: Record<string, number> = {};
      for (const e of events) {
        if (e.timestamp >= today) enteredToday[e.stage] = (enteredToday[e.stage] || 0) + 1;
      }

      const soldDate = (b: any) => b.sold_at || b.updated_at;
      const soldBikes = bikes.filter((b) => b.status === 'sold');
      const soldMonth = soldBikes.filter((b) => soldDate(b) && soldDate(b) >= monthStart);
      const soldLast7 = soldBikes.filter((b) => soldDate(b) && soldDate(b) >= since7).length;

      const openJobs = jobs.filter((j) => !['completed', 'cancelled'].includes(j.status));

      const stageCount = (stage: string) =>
        events.filter((e) => e.stage === stage).length;

      const salePrices = soldMonth.map((b: any) => Number(b.sale_price || 0)).filter((n) => n > 0);
      const salesInvoices = invoices.filter((i) => i.type === 'sale');
      const serviceInvoices = invoices.filter((i) => i.type !== 'sale');
      const amount = (i: any) => Number(i.gross ?? i.total ?? 0);

      setData({
        statusCounts,
        enteredToday,
        totalInSystem: bikes.filter((b) => ACTIVE_STATUSES.includes(b.status)).length,
        soldThisMonth: soldMonth.length,
        soldLast7,
        jobsOpen: openJobs.length,
        jobsWorkshop: openJobs.filter((j) => j.type === 'workshop').length,
        jobsDetailing: openJobs.filter((j) => j.type === 'detailing').length,
        pipeline: {
          intakeToCleaning: stageCount('cleaning'),
          cleaningToInspection: stageCount('inspection'),
          inspectionToApproval: stageCount('repair'),
        },
        revenue: {
          total: invoices.reduce((s, i) => s + amount(i), 0),
          avgSalePrice: salesInvoices.length
            ? salesInvoices.reduce((s, i) => s + amount(i), 0) / salesInvoices.length
            : (salePrices.length ? salePrices.reduce((s, n) => s + n, 0) / salePrices.length : 0),
          services: serviceInvoices.reduce((s, i) => s + amount(i), 0),
        },
        loadedAt: new Date(),
      });
    } catch (e: any) {
      setError(e?.message || 'Could not load dashboard figures.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return { data, loading, error, reload: load };
}
