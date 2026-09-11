import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface BikeSearchResult {
  id: string;
  reference: string | null;
  make: string;
  model: string;
  year: number | null;
  status: string;
  photos: string[] | null;
  frame_number: string | null;
  storage_bay_id: string | null;
}

const FIELDS = ['reference', 'make', 'model', 'frame_number', 'serial_number', 'colour', 'size'];

/** Escape PostgREST `or()` reserved characters in a user-typed term. */
function sanitise(term: string) {
  return term.replace(/[,()*]/g, ' ').trim();
}

/** Debounced global bike search across bike fields and owner names. */
export function useBikeSearch(term: string, minLength = 2) {
  const [results, setResults] = useState<BikeSearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = sanitise(term);
    if (q.length < minLength) {
      setResults([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const timer = window.setTimeout(async () => {
      try {
        const like = `%${q}%`;

        // Owner name matches (staff profiles + external customers).
        const [profilesRes, externalRes] = await Promise.all([
          supabase.from('profiles').select('id').ilike('name', like).limit(20),
          supabase.from('external_owners').select('id').ilike('name', like).limit(20),
        ]);
        const ownerIds = (profilesRes.data || []).map((r: any) => r.id);
        const externalIds = (externalRes.data || []).map((r: any) => r.id);

        const clauses = FIELDS.map((f) => `${f}.ilike.${like}`);
        if (ownerIds.length) clauses.push(`owner_id.in.(${ownerIds.join(',')})`);
        if (externalIds.length) clauses.push(`external_owner_id.in.(${externalIds.join(',')})`);

        const { data, error } = await supabase
          .from('bikes')
          .select('id, reference, make, model, year, status, photos, frame_number, storage_bay_id')
          .or(clauses.join(','))
          .order('created_at', { ascending: false })
          .limit(10);

        if (cancelled) return;
        if (error) {
          console.error('Bike search failed', error);
          setResults([]);
        } else {
          setResults((data as BikeSearchResult[]) || []);
        }
      } catch (e) {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);

    };
  }, [term, minLength]);

  return { results, loading };
}
