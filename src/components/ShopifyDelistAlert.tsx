import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

/** Sold bikes still ticked as listed on Shopify (manual CSV listing). */
export default function ShopifyDelistAlert() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    supabase.from('bikes').select('id', { count: 'exact', head: true })
      .not('shopify_delist_required_at' as any, 'is', null)
      .then(({ count }) => setCount(count ?? 0));
  }, []);
  if (!count) return null;
  return (
    <Link to="/listings" className="flex items-center gap-2 rounded border border-warning/50 bg-warning/10 p-3 text-sm hover:bg-warning/20">
      <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
      <span><strong>Remove from Shopify:</strong> {count} sold bike{count === 1 ? ' is' : 's are'} still listed on your Shopify store. Open Listings to confirm once removed.</span>
    </Link>
  );
}
