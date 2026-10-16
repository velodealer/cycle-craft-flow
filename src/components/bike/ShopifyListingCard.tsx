import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, ShoppingBag, ExternalLink, Download } from 'lucide-react';
import { useListingChannels } from '@/hooks/useListingChannels';
import { useShopifyTemplate } from '@/hooks/useShopifyTemplate';
import { buildListingCsv, downloadCsv } from '@/lib/listingCsv';
import { toast } from 'sonner';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { SHOPIFY_MANUAL_FIELDS, shopifyManualStatus, markShopifyListed, unmarkShopifyListed, markShopifyRemoved, type ShopifyManualState } from '@/lib/shopifyManual';
import {
  getShopifyStatus,
  getBikeListing,
  listBikeOnShopify,
  removeBikeFromShopify,
  markBikeSoldOutOnShopify,
  type ShopifyListing,
} from '@/services/shopify';

interface Props {
  bikeId: string;
}

const LABELS: Record<string, string> = {
  not_listed: 'Not on Shopify',
  listed: 'On sale',
  sold_out: 'Stock zero',
};

export default function ShopifyListingCard({ bikeId }: Props) {
  const [connected, setConnected] = useState(false);
  const [listing, setListing] = useState<ShopifyListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const { settings: channelSettings } = useListingChannels();
  const { template: shopifyTemplate } = useShopifyTemplate();
  const exportManual = async () => {
    setBusy('csv');
    try {
      const res = await buildListingCsv('shopify', [bikeId], channelSettings.markups.shopify, channelSettings.affixes.shopify, shopifyTemplate);
      downloadCsv(res.csv, res.filename);
      if (res.warnings.length) toast.warning(res.warnings.join(' · '));
      else toast.success('Shopify CSV downloaded — import it in Shopify Admin → Products → Import.');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const [manual, setManual] = useState<ShopifyManualState>({});
  const loadManual = useCallback(async () => {
    const { data } = await supabase.from('bikes').select(SHOPIFY_MANUAL_FIELDS).eq('id', bikeId).maybeSingle();
    setManual((data as any) ?? {});
  }, [bikeId]);
  const manualAction = async (fn: () => Promise<void>, msg: string) => {
    try { await fn(); toast.success(msg); await loadManual(); } catch (e) { toast.error((e as Error).message); }
  };

  const load = useCallback(async () => {
    void loadManual();
    try {
      const status = await getShopifyStatus();
      setConnected(status.connected);
      if (status.connected) setListing(await getBikeListing(bikeId));
    } catch {
      setConnected(false);
    } finally {
      setLoading(false);
    }
  }, [bikeId, loadManual]);

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

  if (loading) return null;
  if (!connected) return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ShoppingBag className="h-4 w-4 text-muted-foreground" /> Shopify
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">Shopify isn't connected — download this file and import it in Shopify admin → Products → Import.</p>
        <Button variant="outline" size="sm" disabled={busy === 'csv'} onClick={exportManual}>
          {busy === 'csv' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
          List on Shopify (manual)
        </Button>
        {(() => {
          const st = shopifyManualStatus(manual);
          if (st === 'remove') return (
            <div className="space-y-2 rounded border border-warning/50 bg-warning/10 p-2 text-sm">
              <p>This bike has sold — remove it from your Shopify store.</p>
              <Button size="sm" variant="outline" onClick={() => manualAction(() => markShopifyRemoved(bikeId), 'Marked as removed from Shopify')}>Removed from Shopify</Button>
            </div>
          );
          return (
            <label className="flex flex-wrap items-center gap-2 text-sm">
              <Checkbox checked={st === 'listed'} onCheckedChange={(v) => manualAction(() => (v === true ? markShopifyListed([bikeId]) : unmarkShopifyListed(bikeId)), v === true ? 'Ticked as listed on Shopify' : 'Unticked')} />
              Listed on Shopify
              {st === 'changed' && <Badge variant="outline" className="border-warning text-warning">Changed — re-export</Badge>}
              {st === 'listed' && manual.shopify_manual_listed_at && <span className="text-xs text-muted-foreground">since {new Date(manual.shopify_manual_listed_at).toLocaleDateString()}</span>}
            </label>
          );
        })()}
      </CardContent>
    </Card>
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShoppingBag className="h-4 w-4 text-muted-foreground" /> Shopify
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
        {listing?.last_error && (
          <p className="text-xs text-destructive">{listing.last_error}</p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            disabled={busy !== null}
            onClick={() => run('list', () => listBikeOnShopify(bikeId), listing?.product_id ? 'Shopify listing updated' : 'Bike listed on Shopify')}
          >
            {busy === 'list' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {listing?.product_id ? 'Update listing' : 'List on Shopify'}
          </Button>
          {listing?.product_id && (
            <>
              <Button
                size="sm"
                variant="outline"
                disabled={busy !== null}
                onClick={() => run('sold_out', () => markBikeSoldOutOnShopify(bikeId), 'Shopify stock set to zero')}
              >
                {busy === 'sold_out' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Set stock to zero
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy !== null}
                onClick={() => run('unlist', () => removeBikeFromShopify(bikeId), 'Removed from Shopify')}
              >
                {busy === 'unlist' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Remove listing
              </Button>
              {listing.product_url && (
                <Button size="sm" variant="ghost" asChild>
                  <a href={listing.product_url} target="_blank" rel="noreferrer">
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
