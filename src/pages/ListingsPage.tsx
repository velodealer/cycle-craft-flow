import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/velo/PageShell';
import { StageFlap, stageLabel } from '@/components/velo/StageFlap';
import { bikeRef } from '@/lib/bikeReference';
import BikeThumbnail from '@/components/bike/BikeThumbnail';
import { ListCard, ListCardRow, ListEmpty } from '@/components/ui/list-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Globe, ChevronLeft, ChevronRight, ExternalLink, CheckCircle2, RefreshCw } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { listBikeOnEbay, getEbayStatus, type EbayStatus } from '@/services/ebay';
import { listBikeOnShopify, getShopifyStatus, type ShopifyStatus, type ShopifyListing } from '@/services/shopify';

interface Bike {
  id: string;
  reference: string | null;
  make: string;
  model: string;
  year: number | null;
  status: string;
  source: string;
  asking_price: number | null;
  sale_price: number | null;
  photos: string[] | null;
  storage_bay_id: string | null;
  frame_number: string | null;
  serial_number?: string | null;
}

interface PlatformRow {
  bike_id: string;
  url: string | null;
  status: string;
  last_synced_at: string | null;
  last_error: string | null;
}

interface BikeWithPlatforms extends Bike {
  ebay: PlatformRow | null;
  shopify: PlatformRow | null;
}

const PAGE_SIZE = 25;

const isActive = (row: PlatformRow | null) => !!row && row.status === 'listed';

export default function ListingsPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [bikes, setBikes] = useState<BikeWithPlatforms[]>([]);
  const [ebayStatus, setEbayStatus] = useState<EbayStatus | null>(null);
  const [shopifyStatus, setShopifyStatus] = useState<ShopifyStatus | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [listingIds, setListingIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [bulk, setBulk] = useState<{ kind: 'list' | 'sync'; done: number; total: number } | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const { data: bikeRows, error } = await supabase
          .from('bikes')
          .select('id, reference, make, model, year, status, source, asking_price, sale_price, photos, storage_bay_id, frame_number, serial_number')
          .in('status', ['ready', 'listed'])
          .order('created_at', { ascending: false });
        if (error) throw error;
        const rows = (bikeRows as Bike[]) || [];

        const ids = rows.map((b) => b.id);
        const [ebayRows, shopifyRows, ebaySt, shopifySt] = await Promise.all([
          ids.length
            ? supabase
                .from('ebay_listings')
                .select('bike_id, listing_url, status, last_synced_at, last_error')
                .in('bike_id', ids)
            : Promise.resolve({ data: [], error: null } as any),
          ids.length
            ? supabase
                .from('shopify_listings')
                .select('bike_id, product_url, status, last_synced_at, last_error')
                .in('bike_id', ids)
            : Promise.resolve({ data: [], error: null } as any),
          getEbayStatus().catch(() => null),
          getShopifyStatus().catch(() => null),
        ]);
        if (ebayRows.error) throw ebayRows.error;
        if (shopifyRows.error) throw shopifyRows.error;

        if (cancelled) return;

        const ebayById = new Map<string, PlatformRow>();
        ((ebayRows.data as any[]) || []).forEach((r) =>
          ebayById.set(r.bike_id, {
            bike_id: r.bike_id,
            url: r.listing_url ?? null,
            status: r.status,
            last_synced_at: r.last_synced_at,
            last_error: r.last_error,
          }),
        );
        const shopifyById = new Map<string, PlatformRow>();
        ((shopifyRows.data as any[]) || []).forEach((r) =>
          shopifyById.set(r.bike_id, {
            bike_id: r.bike_id,
            url: r.product_url ?? null,
            status: r.status,
            last_synced_at: r.last_synced_at,
            last_error: r.last_error,
          }),
        );

        setBikes(
          rows.map((b) => ({
            ...b,
            ebay: ebayById.get(b.id) ?? null,
            shopify: shopifyById.get(b.id) ?? null,
          })),
        );
        setEbayStatus(ebaySt);
        setShopifyStatus(shopifySt);
      } catch (error: any) {
        toast({ title: 'Error loading listings', description: error.message, variant: 'destructive' });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, statusFilter]);

  const filteredBikes = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return bikes.filter((bike) => {
      const matchesSearch =
        term === '' ||
        bike.make.toLowerCase().includes(term) ||
        bike.model.toLowerCase().includes(term) ||
        `${bike.make} ${bike.model}`.toLowerCase().includes(term) ||
        bike.frame_number?.toLowerCase().includes(term) ||
        bike.serial_number?.toLowerCase().includes(term) ||
        bike.reference?.toLowerCase().includes(term) ||
        bike.id.toLowerCase().includes(term);
      const matchesStatus = statusFilter === 'all' || bike.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [bikes, searchTerm, statusFilter]);

  const pageCount = Math.max(1, Math.ceil(filteredBikes.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visibleBikes = filteredBikes.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const ebayConnected = !!ebayStatus?.connected;
  const ebayNeedsReconnect = ebayConnected && !!ebayStatus?.needs_reconnect;
  const ebaySandbox = ebayConnected && ebayStatus?.environment === 'sandbox';
  const shopifyConnected = !!shopifyStatus?.connected;
  const anyConnected = ebayConnected || shopifyConnected;

  const isBusy = (bikeId: string, platform: 'ebay' | 'shopify') => listingIds.has(`${bikeId}:${platform}`);

  const listTargets = (bike: BikeWithPlatforms) => {
    const targets: { platform: 'ebay' | 'shopify' }[] = [];
    if (ebayConnected && !isActive(bike.ebay)) targets.push({ platform: 'ebay' });
    if (shopifyConnected && !isActive(bike.shopify)) targets.push({ platform: 'shopify' });
    return targets;
  };

  const applyResult = (bikeId: string, platform: 'ebay' | 'shopify', url: string | null) => {
    setBikes((prev) =>
      prev.map((b) =>
        b.id === bikeId
          ? {
              ...b,
              [platform]: {
                bike_id: bikeId,
                url,
                status: 'listed',
                last_synced_at: new Date().toISOString(),
                last_error: null,
              } as PlatformRow,
            }
          : b,
      ),
    );
  };

  const setBusy = (key: string, on: boolean) =>
    setListingIds((prev) => {
      const next = new Set(prev);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });

  const labelOf = (p: 'ebay' | 'shopify') => (p === 'ebay' ? 'eBay' : 'Shopify');

  // Lists (or, when already live, updates) a bike on one platform. Returns an error message or null.
  const listOn = async (
    bike: BikeWithPlatforms,
    platform: 'ebay' | 'shopify',
    opts: { quiet?: boolean; sync?: boolean } = {},
  ): Promise<string | null> => {
    const key = `${bike.id}:${platform}`;
    setBusy(key, true);
    const label = labelOf(platform);
    const done = opts.sync ? `Synced on ${label}` : `Listed on ${label}`;
    try {
      if (platform === 'ebay') {
        const res = await listBikeOnEbay(bike.id);
        applyResult(bike.id, 'ebay', res.url ?? bike.ebay?.url ?? null);
        if (!opts.quiet) {
          toast(res.warnings?.length
            ? { title: `${done}, with notes`, description: res.warnings.join(' ') }
            : { title: done, description: `${bike.make} ${bike.model} is ${opts.sync ? 'up to date' : 'now live'}.` });
        }
      } else {
        const res = await listBikeOnShopify(bike.id);
        applyResult(bike.id, 'shopify', res.url ?? bike.shopify?.url ?? null);
        if (!opts.quiet) toast({ title: done, description: `${bike.make} ${bike.model} is ${opts.sync ? 'up to date' : 'now live'}.` });
      }
      return null;
    } catch (error: any) {
      const msg = error?.message || 'Unknown error';
      if (!opts.quiet) toast({ title: `Could not ${opts.sync ? 'sync' : 'list'} on ${label}`, description: msg, variant: 'destructive' });
      return msg;
    } finally {
      setBusy(key, false);
    }
  };

  const handleList = async (bike: BikeWithPlatforms, only?: ('ebay' | 'shopify')[]) => {
    const targets = listTargets(bike).filter((t) => !only || only.includes(t.platform));
    for (const { platform } of targets) {
      await listOn(bike, platform);
    }
  };

  const liveTargets = (bike: BikeWithPlatforms) => {
    const t: ('ebay' | 'shopify')[] = [];
    if (ebayConnected && isActive(bike.ebay)) t.push('ebay');
    if (shopifyConnected && isActive(bike.shopify)) t.push('shopify');
    return t;
  };

  const handleSync = async (bike: BikeWithPlatforms) => {
    for (const p of liveTargets(bike)) await listOn(bike, p, { sync: true });
  };

  const toListCount = filteredBikes.filter((b) => listTargets(b).length > 0).length;
  const toSyncCount = filteredBikes.filter((b) => liveTargets(b).length > 0).length;

  const runBulk = async (kind: 'list' | 'sync') => {
    const jobs = filteredBikes.flatMap((b) =>
      (kind === 'list' ? listTargets(b).map((t) => t.platform) : liveTargets(b)).map((p) => ({ bike: b, p })),
    );
    if (jobs.length === 0) return;
    const bikeCount = new Set(jobs.map((j) => j.bike.id)).size;
    const sites = Array.from(new Set(jobs.map((j) => labelOf(j.p)))).join(' and ');
    if (!window.confirm(`${kind === 'list' ? 'List' : 'Sync'} ${bikeCount} bike${bikeCount === 1 ? '' : 's'} on ${sites}?`)) return;
    setBulk({ kind, done: 0, total: jobs.length });
    const failures: string[] = [];
    for (let i = 0; i < jobs.length; i++) {
      const { bike, p } = jobs[i];
      const err = await listOn(bike, p, { quiet: true, sync: kind === 'sync' });
      if (err) failures.push(`${bikeRef(bike as any)} (${labelOf(p)}): ${err}`);
      setBulk({ kind, done: i + 1, total: jobs.length });
    }
    setBulk(null);
    const ok = jobs.length - failures.length;
    toast({
      title: `${kind === 'list' ? 'Listed' : 'Synced'} ${ok} of ${jobs.length}`,
      description: failures.length ? failures.slice(0, 5).join(' · ') + (failures.length > 5 ? ` · +${failures.length - 5} more` : '') : 'All done.',
      variant: failures.length && ok === 0 ? 'destructive' : undefined,
    });
  };
  const runListAll = () => runBulk('list');
  const runSyncAll = () => runBulk('sync');

  const renderPlatformButton = (bike: BikeWithPlatforms, platform: 'ebay' | 'shopify') => {
    const row = bike[platform];
    const live = isActive(row);
    const busyP = isBusy(bike.id, platform);
    const label = labelOf(platform);
    const tag = platform === 'ebay' && ebaySandbox
      ? <span className="ml-1 text-[10px] uppercase text-muted-foreground">sandbox</span>
      : null;
    if (live && row?.url) {
      return (
        <Button key={platform} size="sm" variant="outline" className="flex-1 min-w-[8rem]" asChild>
          <a href={row.url} target="_blank" rel="noopener noreferrer">
            <CheckCircle2 className="h-4 w-4 mr-1" /> Listed on {label} <ExternalLink className="h-3 w-3 ml-1" />{tag}
          </a>
        </Button>
      );
    }
    return (
      <Button
        key={platform}
        size="sm"
        variant="outline"
        className="flex-1 min-w-[8rem]"
        disabled={live || busyP || !!bulk}
        onClick={() => handleList(bike, [platform])}
      >
        {busyP ? 'Working…' : live ? `Listed on ${label}` : `List on ${label}`}
        {tag}
      </Button>
    );
  };

  const platformBadges = (bike: BikeWithPlatforms) => {
    const badges: React.ReactNode[] = [];
    if (bike.ebay) {
      if (isActive(bike.ebay)) {
        badges.push(
          bike.ebay.url ? (
            <a
              key="ebay"
              href={bike.ebay.url}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20"
            >
              eBay <ExternalLink className="h-3 w-3" />
            </a>
          ) : (
            <Badge key="ebay" variant="default">eBay</Badge>
          ),
        );
      } else if (bike.ebay.status === 'ended') {
        badges.push(
          <Badge key="ebay" variant="outline" className="text-muted-foreground">eBay · ended</Badge>,
        );
      }
    }
    if (bike.shopify) {
      if (isActive(bike.shopify)) {
        badges.push(
          bike.shopify.url ? (
            <a
              key="shopify"
              href={bike.shopify.url}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20"
            >
              Shopify <ExternalLink className="h-3 w-3" />
            </a>
          ) : (
            <Badge key="shopify" variant="default">Shopify</Badge>
          ),
        );
      } else if (bike.shopify.status === 'sold_out') {
        badges.push(
          <Badge key="shopify" variant="outline" className="text-muted-foreground">Shopify · sold out</Badge>,
        );
      }
    }
    if (bike.ebay?.last_error && !isActive(bike.ebay)) {
      badges.push(
        <Badge key="ebay-err" variant="destructive">eBay error</Badge>,
      );
    }
    return badges;
  };

  if (loading) {
    return (
      <div>
        <PageHeader title="Listings" description="Bikes ready to go live, and what they're listed on." />
        <div className="flex justify-center p-8">Loading listings...</div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Listings" description="Bikes ready to go live, and what they're listed on." />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <Button
          size="lg"
          className="flex-1 h-14 text-base"
          disabled={!anyConnected || !!bulk || toListCount === 0}
          onClick={runListAll}
        >
          <Globe className="h-5 w-5 mr-2" />
          {bulk?.kind === 'list'
            ? `Listing ${bulk.done + 1 > bulk.total ? bulk.total : bulk.done + 1} of ${bulk.total}…`
            : toListCount === 0
              ? 'All bikes listed'
              : `List all bikes (${toListCount})`}
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="flex-1 h-14 text-base"
          disabled={!!bulk || toSyncCount === 0}
          onClick={runSyncAll}
        >
          <RefreshCw className={`h-5 w-5 mr-2 ${bulk?.kind === 'sync' ? 'animate-spin' : ''}`} />
          {bulk?.kind === 'sync'
            ? `Syncing ${bulk.done + 1 > bulk.total ? bulk.total : bulk.done + 1} of ${bulk.total}…`
            : `Sync all listings (${toSyncCount})`}
        </Button>
      </div>


      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Bikes ({filteredBikes.length})</CardTitle>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative sm:w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search bikes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent className="bg-popover z-50">
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="ready">Ready</SelectItem>
                <SelectItem value="listed">Listed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {!anyConnected && (
            <p className="mb-4 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
              Neither eBay nor Shopify is connected. Connect a platform under Settings → Integrations to list bikes.
            </p>
          )}
          {ebayNeedsReconnect && (
            <p className="mb-4 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
              eBay needs reconnecting before bikes can be listed.{' '}
              <button type="button" className="underline font-medium" onClick={() => navigate('/settings?tab=integrations')}>
                Settings → Integrations → eBay
              </button>
            </p>
          )}

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {visibleBikes.length === 0 ? (
              <div className="md:col-span-2 xl:col-span-3">
                <ListEmpty message={bikes.length === 0 ? 'No bikes are Ready or Listed yet' : 'No bikes match your search'} />
              </div>
            ) : (
              visibleBikes.map((bike) => {
                const targets = listTargets(bike);
                const allListed = anyConnected && targets.length === 0;
                const busy = isBusy(bike.id, 'ebay') || isBusy(bike.id, 'shopify');
                return (
                  <ListCard key={bike.id} onClick={() => navigate(`/bikes/${bike.id}`)}>
                    <div className="flex gap-3">
                      <BikeThumbnail photos={bike.photos} alt={`${bike.make} ${bike.model}`} className="h-16 w-16 shrink-0" />
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="font-semibold leading-tight break-words">
                          {bike.make} {bike.model}
                          {bike.year ? <span className="text-muted-foreground"> · {bike.year}</span> : null}
                        </div>
                        <div className="id-text">{bikeRef(bike as any)}</div>
                        <div className="flex flex-wrap items-center gap-2">
                          <StageFlap stage={bike.status} size="sm" />
                          {platformBadges(bike)}
                        </div>
                      </div>
                    </div>

                    <ListCardRow label="Asking" value={bike.asking_price ? `£${bike.asking_price.toFixed(2)}` : '-'} />

                    <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                      {!allListed && (
                        <Button
                          className="w-full"
                          disabled={!anyConnected || busy || !!bulk}
                          onClick={() => handleList(bike)}
                          title={!anyConnected ? 'Connect eBay or Shopify in Settings first' : undefined}
                        >
                          <Globe className="h-4 w-4 mr-2" />
                          {busy ? 'Working…' : 'List everywhere'}
                        </Button>
                      )}
                      <div className="flex flex-wrap gap-2">
                        {ebayConnected && renderPlatformButton(bike, 'ebay')}
                        {shopifyConnected && renderPlatformButton(bike, 'shopify')}
                      </div>
                      {liveTargets(bike).length > 0 && (
                        <Button
                          size="sm"
                          variant="secondary"
                          className="w-full"
                          disabled={busy || !!bulk}
                          onClick={() => handleSync(bike)}
                        >
                          <RefreshCw className={`h-4 w-4 mr-2 ${busy ? 'animate-spin' : ''}`} />
                          {busy ? 'Syncing…' : 'Sync listing'}
                        </Button>
                      )}
                    </div>
                  </ListCard>
                );
              })
            )}
          </div>

          {filteredBikes.length > 0 && (
            <div className="mt-4 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filteredBikes.length)} of {filteredBikes.length}
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setPage((v) => Math.max(1, v - 1))}>
                  <ChevronLeft className="mr-1 h-4 w-4" /> Previous
                </Button>
                <span className="text-sm tabular">Page {currentPage} of {pageCount}</span>
                <Button variant="outline" size="sm" disabled={currentPage === pageCount} onClick={() => setPage((v) => Math.min(pageCount, v + 1))}>
                  Next <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
