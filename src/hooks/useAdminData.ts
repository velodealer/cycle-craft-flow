import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface PlatformOverview {
  total_businesses: number;
  active_businesses: number;
  pending_businesses: number;
  suspended_businesses: number;
  new_businesses_30d: number;
  total_users: number;
  new_users_30d: number;
  total_bikes: number;
  bikes_sold_30d: number;
  mrr: number;
  paying_subscriptions: number;
  signups_by_month: { month: string; count: number }[];
}

export interface DealershipStat {
  business_id: string;
  business_name: string;
  contact_email: string | null;
  status: string;
  created_at: string;
  users_count: number;
  bikes_total: number;
  bikes_in_stock: number;
  bikes_added: number;
  bikes_sold: number;
  sale_value: number;
  jobs_completed: number;
  last_activity: string;
  plan_name: string | null;
  subscription_status: string | null;
  price: number | null;
  billing_period: string | null;
}

export interface IntegrationHealthRow {
  business_id: string;
  business_name: string;
  integration: string;
  connected: boolean;
  status: string | null;
  last_error: string | null;
}

export interface SubscriptionRow {
  id: string;
  business_id: string;
  plan_name: string;
  price: number;
  currency: string;
  billing_period: string;
  seats: number;
  status: string;
  trial_ends_at: string | null;
  current_period_end: string | null;
  notes: string | null;
}

const client = supabase as any;

export function usePlatformOverview() {
  return useQuery({
    queryKey: ['admin', 'overview'],
    queryFn: async (): Promise<PlatformOverview> => {
      const { data, error } = await client.rpc('admin_platform_overview');
      if (error) throw error;
      return data as PlatformOverview;
    },
  });
}

export function useDealershipStats(from?: Date, to?: Date) {
  const fromIso = from?.toISOString();
  const toIso = to?.toISOString();
  return useQuery({
    queryKey: ['admin', 'dealership-stats', fromIso, toIso],
    queryFn: async (): Promise<DealershipStat[]> => {
      const { data, error } = await client.rpc('admin_dealership_stats', {
        ...(fromIso ? { _from: fromIso } : {}),
        ...(toIso ? { _to: toIso } : {}),
      });
      if (error) throw error;
      return (data ?? []) as DealershipStat[];
    },
  });
}

export function useIntegrationHealth() {
  return useQuery({
    queryKey: ['admin', 'integration-health'],
    queryFn: async (): Promise<IntegrationHealthRow[]> => {
      const { data, error } = await client.rpc('admin_integration_health');
      if (error) throw error;
      return (data ?? []) as IntegrationHealthRow[];
    },
  });
}

export function useSubscriptions() {
  return useQuery({
    queryKey: ['admin', 'subscriptions'],
    queryFn: async (): Promise<SubscriptionRow[]> => {
      const { data, error } = await client.from('business_subscriptions').select('*');
      if (error) throw error;
      return (data ?? []) as SubscriptionRow[];
    },
  });
}

export const money = (value: number | null | undefined, currency = 'GBP') =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency, maximumFractionDigits: 0 }).format(
    Number(value ?? 0),
  );
