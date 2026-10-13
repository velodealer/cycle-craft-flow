import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { shopifyTemplateKey, type ShopifyCsvTemplate } from '@/lib/shopifyTemplate';

/** Dealer's uploaded Shopify CSV header template (null = use the default export layout). */
export function useShopifyTemplate() {
  const [template, setTemplate] = useState<ShopifyCsvTemplate | null>(null);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: bid } = await supabase.rpc('current_business_id');
      if (!active || !bid) { setLoading(false); return; }
      setBusinessId(bid as string);
      const { data } = await supabase.from('app_settings').select('value').eq('key', shopifyTemplateKey(bid as string)).maybeSingle();
      if (!active) return;
      const v = data?.value as any;
      setTemplate(v && Array.isArray(v.headers) && v.headers.length ? { headers: v.headers, mapping: v.mapping ?? {}, fileName: v.fileName, savedAt: v.savedAt } : null);
      setLoading(false);
    })();
    return () => { active = false; };
  }, []);

  const save = useCallback(async (next: ShopifyCsvTemplate | null) => {
    if (!businessId) throw new Error('No dealership found');
    const key = shopifyTemplateKey(businessId);
    const { error } = next
      ? await supabase.from('app_settings').upsert({ key, value: next as never }, { onConflict: 'key' })
      : await supabase.from('app_settings').delete().eq('key', key);
    if (error) throw new Error(error.message);
    setTemplate(next);
  }, [businessId]);

  return { template, loading, save };
}
