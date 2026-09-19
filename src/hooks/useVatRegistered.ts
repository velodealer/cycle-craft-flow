import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const VAT_REGISTERED_KEY = 'vat_registered';

/** Reads the per-business VAT registration flag. Defaults to true when unset. */
export function useVatRegistered() {
  const [vatRegistered, setVatRegistered] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    supabase
      .from('app_settings')
      .select('value')
      .eq('key', VAT_REGISTERED_KEY)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        const raw = data?.value as unknown;
        if (raw === false || raw === 'false') setVatRegistered(false);
        else setVatRegistered(true);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return { vatRegistered, loading, setVatRegistered };
}
