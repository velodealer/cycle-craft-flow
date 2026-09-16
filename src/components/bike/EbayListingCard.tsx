import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Tag, ExternalLink, Search, Save } from 'lucide-react';
import { toast } from 'sonner';
import {
  getEbayStatus,
  getBikeEbayListing,
  listBikeOnEbay,
  endBikeOnEbay,
  removeBikeFromEbay,
  saveBikeEbayOptions,
  searchEbayCategories,
  type EbayListing,
  type PolicyOption,
} from '@/services/ebay';

interface Props {
  bikeId: string;
}

const LABELS: Record<string, string> = {
  not_listed: 'Not on eBay',
  listed: 'On sale',
  ended: 'Listing ended',
};

const CONDITIONS = [
  { value: 'NEW', label: 'New' },
  { value: 'USED_EXCELLENT', label: 'Used — excellent' },
  { value: 'USED_VERY_GOOD', label: 'Used — very good' },
  { value: 'USED_GOOD', label: 'Used — good' },
  { value: 'USED_ACCEPTABLE', label: 'Used — acceptable' },
  { value: 'FOR_PARTS_OR_NOT_WORKING', label: 'For parts or not working' },
];

export default function EbayListingCard({ bikeId }: Props) {
  const [connected, setConnected] = useState(false);
  const [listing, setListing] = useState<EbayListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const [defaults, setDefaults] = useState({ condition: 'USED_EXCELLENT', category_id: '177831' });
  const [condition, setCondition] = useState('USED_EXCELLENT');
  const [categoryId, setCategoryId] = useState('');
  const [categoryQuery, setCategoryQuery] = useState('');
  const [categories, setCategories] = useState<PolicyOption[]>([]);
  const [searching, setSearching] = useState(false);

  const load = useCallback(async () => {
    try {
      const status = await getEbayStatus();
      setConnected(status.connected);
      if (status.connected) {
        setDefaults({
          condition: status.condition || 'USED_EXCELLENT',
          category_id: status.category_id || '177831',
        });
        const row = await getBikeEbayListing(bikeId);
        setListing(row);
        setCondition(row?.condition || status.condition || 'USED_EXCELLENT');
        setCategoryId(row?.category_id || '');
      }
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

  const handleSearch = async () => {
    setSearching(true);
    try {
      const { categories: list } = await searchEbayCategories(categoryQuery || 'bicycle');
      setCategories(list);
      if (!list.length) toast.info('No matching eBay categories found');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSearching(false);
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
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Item condition</Label>
            <Select value={condition} onValueChange={setCondition}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CONDITIONS.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`ebay-cat-${bikeId}`}>eBay category number</Label>
            <Input
              id={`ebay-cat-${bikeId}`}
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              placeholder={`Default ${defaults.category_id}`}
            />
          </div>
        </div>

        <div className="space-y-2 rounded-lg border p-3">
          <Label htmlFor={`ebay-cat-search-${bikeId}`} className="text-xs">Find a category</Label>
          <div className="flex gap-2">
            <Input
              id={`ebay-cat-search-${bikeId}`}
              value={categoryQuery}
              onChange={(e) => setCategoryQuery(e.target.value)}
              placeholder="mountain bike"
            />
            <Button variant="outline" onClick={handleSearch} disabled={searching}>
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>
          {categories.length > 0 && (
            <div className="space-y-1">
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => { setCategoryId(c.id); toast.success('Category selected'); }}
                  className="block w-full rounded px-2 py-1 text-left text-xs hover:bg-muted"
                >
                  {c.name} <span className="text-muted-foreground">({c.id})</span>
                </button>
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Leave the category blank to use the default set in Settings.
          </p>
        </div>

        {listing?.last_synced_at && (
          <p className="text-xs text-muted-foreground">
            Last updated {new Date(listing.last_synced_at).toLocaleString()}
          </p>
        )}
        {listing?.last_error && <p className="text-xs text-destructive">{listing.last_error}</p>}
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={busy !== null}
            onClick={() => run(
              'save',
              () => saveBikeEbayOptions(bikeId, { condition, category_id: categoryId.trim() || null }),
              'Saved for this bike',
            )}
          >
            {busy === 'save' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save options
          </Button>
          <Button
            size="sm"
            disabled={busy !== null}
            onClick={() => run(
              'list',
              async () => {
                await saveBikeEbayOptions(bikeId, { condition, category_id: categoryId.trim() || null });
                await listBikeOnEbay(bikeId);
              },
              listing?.offer_id ? 'eBay listing updated' : 'Bike listed on eBay',
            )}
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
