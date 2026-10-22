import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export const VAT_REGISTERED_KEY = 'vat_registered';

/** Reads this dealership's VAT registration flag. Defaults to true when unset. */
export function useVatRegistered() {
  const { businessId } = useAuth();
  const [vatRegistered, setVatRegistered] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!businessId) return;
    let active = true;
    supabase
      .from('app_settings')
      .select('value')
      .eq('key', `${VAT_REGISTERED_KEY}:${businessId}`)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        const raw = data?.value as unknown;
        setVatRegistered(!(raw === false || raw === 'false'));
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [businessId]);

  return { vatRegistered, loading, setVatRegistered };
}
