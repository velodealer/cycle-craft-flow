import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface StorageBay {
  id: string;
  name: string;
  zone: string | null;
  notes: string | null;
  is_active: boolean;
  sort_order: number;
}

export function useStorageBays(includeInactive = false) {
  const [bays, setBays] = useState<StorageBay[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('storage_bays')
      .select('id, name, zone, notes, is_active, sort_order')
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });

    if (!includeInactive) query = query.eq('is_active', true);

    const { data } = await query;
    setBays((data as StorageBay[]) || []);
    setLoading(false);
  }, [includeInactive]);

  useEffect(() => {
    load();
  }, [load]);

  return { bays, loading, reload: load };
}
