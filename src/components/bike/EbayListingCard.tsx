import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Tag, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import {
  getEbayStatus,
  getBikeEbayListing,
  listBikeOnEbay,
  endBikeOnEbay,
  removeBikeFromEbay,
  type EbayListing,
} from '@/services/ebay';

interface Props {
  bikeId: string;
}

const LABELS: Record<string, string> = {
  not_listed: 'Not on eBay',
  listed: 'On sale',
  ended: 'Listing ended',
};

export default function EbayListingCard({ bikeId }: Props) {
  const [connected, setConnected] = useState(false);
  const [listing, setListing] = useState<EbayListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const status = await getEbayStatus();
      setConnected(status.connected);
      if (status.connected) setListing(await getBikeEbayListing(bikeId));
    } catch {
      setConnected(false);
    } finally {
      setLoading(false);
    }
  }, [bikeId]);

  useEffect(() => { load(); }, [load]);

  const run = async (name: string, fn: () => Promise<unknown>, success: string) => {
    setBusy(name);
    try {
      await fn();
      toast.success(success);
      await load();
    } catch (e) {
      toast.error((e as Error).message);
      await load();
    } finally {
      setBusy(null);
    }
  };

  if (loading || !connected) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Tag className="h-4 w-4 text-muted-foreground" /> eBay
          </CardTitle>
          <Badge variant={listing?.status === 'listed' ? 'default' : 'secondary'}>
            {LABELS[listing?.status ?? 'not_listed'] ?? listing?.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {listing?.last_synced_at && (
          <p className="text-xs text-muted-foreground">
            Last updated {new Date(listing.last_synced_at).toLocaleString()}
          </p>
        )}
        {listing?.last_error && <p className="text-xs text-destructive">{listing.last_error}</p>}
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            disabled={busy !== null}
            onClick={() => run('list', () => listBikeOnEbay(bikeId), listing?.offer_id ? 'eBay listing updated' : 'Bike listed on eBay')}
          >
            {busy === 'list' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {listing?.offer_id ? 'Update listing' : 'List on eBay'}
          </Button>
          {listing?.offer_id && (
            <>
              <Button
                size="sm"
                variant="outline"
                disabled={busy !== null}
                onClick={() => run('end', () => endBikeOnEbay(bikeId), 'eBay listing ended')}
              >
                {busy === 'end' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                End listing
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy !== null}
                onClick={() => run('remove', () => removeBikeFromEbay(bikeId), 'Removed from eBay')}
              >
                {busy === 'remove' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Remove
              </Button>
              {listing.listing_url && (
                <Button size="sm" variant="ghost" asChild>
                  <a href={listing.listing_url} target="_blank" rel="noreferrer">
                    View <ExternalLink className="ml-1 h-3 w-3" />
                  </a>
                </Button>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
