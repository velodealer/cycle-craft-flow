import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Store, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import {
  getSquarespaceStatus, getBikeSquarespaceListing, listBikeOnSquarespace, removeBikeFromSquarespace,
  markBikeSoldOutOnSquarespace, type SquarespaceListing,
} from '@/services/squarespace';

const LABELS: Record<string, string> = { not_listed: 'Not on Squarespace', listed: 'On sale', sold_out: 'Sold out' };

export default function SquarespaceListingCard({ bikeId }: { bikeId: string }) {
  const [connected, setConnected] = useState(false);
  const [listing, setListing] = useState<SquarespaceListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const s = await getSquarespaceStatus();
      setConnected(s.connected);
      if (s.connected) setListing(await getBikeSquarespaceListing(bikeId));
    } catch {
      setConnected(false);
    } finally {
      setLoading(false);
    }
  }, [bikeId]);

  useEffect(() => { load(); }, [load]);

  const run = async (name: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(name);
    try { await fn(); toast.success(ok); } catch (e) { toast.error((e as Error).message); }
    await load();
    setBusy(null);
  };

  if (loading || !connected) return null;
  const live = !!listing?.product_id;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Store className="h-4 w-4 text-muted-foreground" /> Squarespace
          </CardTitle>
          <Badge variant={listing?.status === 'listed' ? 'default' : 'secondary'}>
            {LABELS[listing?.status ?? 'not_listed'] ?? listing?.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {listing?.last_synced_at && (
          <p className="text-xs text-muted-foreground">Last updated {new Date(listing.last_synced_at).toLocaleString()}</p>
        )}
        {listing?.last_error && <p className="text-xs text-destructive">{listing.last_error}</p>}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={!!busy}
            onClick={() => run('list', () => listBikeOnSquarespace(bikeId), live ? 'Squarespace listing updated' : 'Bike listed on Squarespace')}>
            {busy === 'list' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {live ? 'Update listing' : 'List on Squarespace'}
          </Button>
          {live && (
            <>
              <Button size="sm" variant="outline" disabled={!!busy}
                onClick={() => run('sold', () => markBikeSoldOutOnSquarespace(bikeId), 'Marked sold out on Squarespace')}>
                Mark sold out
              </Button>
              <Button size="sm" variant="outline" disabled={!!busy}
                onClick={() => run('unlist', () => removeBikeFromSquarespace(bikeId), 'Removed from Squarespace')}>
                Remove listing
              </Button>
              {listing?.url && (
                <Button size="sm" variant="ghost" asChild>
                  <a href={listing.url} target="_blank" rel="noopener noreferrer">View <ExternalLink className="ml-1 h-3 w-3" /></a>
                </Button>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
