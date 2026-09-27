import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { listingChannelsKey, normaliseChannelSettings, type ListingChannelSettings } from '@/lib/channelPricing';

/** Per-dealership manual listing toggles and channel price mark-ups. */
export function useListingChannels() {
  const [settings, setSettings] = useState<ListingChannelSettings>(normaliseChannelSettings(null));
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: bid, error: bErr } = await supabase.rpc('current_business_id');
      if (!active) return;
      if (bErr || !bid) { setError(bErr?.message ?? 'No dealership found'); setLoading(false); return; }
      setBusinessId(bid as string);
      const { data, error: sErr } = await supabase.from('app_settings').select('value').eq('key', listingChannelsKey(bid as string)).maybeSingle();
      if (!active) return;
      if (sErr) setError(sErr.message);
      else setSettings(normaliseChannelSettings(data?.value));
      setLoading(false);
    })();
    return () => { active = false; };
  }, []);

  const save = useCallback(async (next: ListingChannelSettings) => {
    if (!businessId) throw new Error('No dealership found');
    const { error: e } = await supabase
      .from('app_settings')
      .upsert({ key: listingChannelsKey(businessId), value: next as never }, { onConflict: 'key' });
    if (e) throw new Error(e.message);
    setSettings(next);
  }, [businessId]);

  return { settings, loading, error, save };
}
