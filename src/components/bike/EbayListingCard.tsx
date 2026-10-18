import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Tag, ExternalLink, Search, Save, CheckCircle2, AlertTriangle, XCircle, RefreshCw, Truck, Pencil, Wand2 } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';

const EDITABLE = new Set(['price', 'type', 'condition_notes', 'listing_description', 'title', 'category', 'condition', 'photos', 'specifics', 'specifics_required', 'specifics_unmapped', 'policies', 'location']);
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  getEbayStatus,
  getBikeEbayListing,
  listBikeOnEbay,
  endBikeOnEbay,
  removeBikeFromEbay,
  saveBikeEbayOptions,
  searchEbayCategories,
  previewBikeOnEbay,
  getBikeEbayOrders,
  markEbayOrderDespatched,
  type EbayListing,
  type EbayPreview,
  type EbayOrder,
  type PolicyOption,
} from '@/services/ebay';
import { EBAY_TITLE_MAX } from '@/lib/ebayTitle';
import FixListingProblemsDialog from './FixListingProblemsDialog';
import { effectiveListingImages } from '@/lib/listingImages';
import { generateDescription } from '@/lib/descriptionGenerator';
import { fetchBikeComponents } from '../../../supabase/functions/_shared/bike-components';

interface Props {
  bikeId: string;
  /** Changes whenever the bike record changes, so photos/title/checks reload. */
  refreshKey?: string;
}

const LABELS: Record<string, string> = {
  not_listed: 'Not on eBay',
  listed: 'On sale',
  ended: 'Listing ended',
  sold: 'Sold on eBay',
};

const CONDITIONS = [
  { value: 'NEW', label: 'New' },
  { value: 'USED_EXCELLENT', label: 'Used — excellent (eBay "Used")' },
  { value: 'USED_VERY_GOOD', label: 'Used — very good (eBay bikes: "Used")' },
  { value: 'USED_GOOD', label: 'Used — good (eBay bikes: "Used")' },
  { value: 'USED_ACCEPTABLE', label: 'Used — acceptable (eBay bikes: "Used")' },
  { value: 'FOR_PARTS_OR_NOT_WORKING', label: 'For parts or not working' },
];
const conditionName = (value: string) => CONDITIONS.find((c) => c.value === value)?.label ?? value;

const LevelIcon = ({ level }: { level: 'ok' | 'warn' | 'block' }) =>
  level === 'ok' ? <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
    : level === 'warn' ? <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
      : <XCircle className="h-4 w-4 shrink-0 text-destructive" />;

export default function EbayListingCard({ bikeId, refreshKey }: Props) {
  const [connected, setConnected] = useState(false);
  const [canManage, setCanManage] = useState(false);
  const [listing, setListing] = useState<EbayListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const [defaults, setDefaults] = useState({ condition: 'USED_EXCELLENT', category_id: '177831', best_offer: false });
  const [condition, setCondition] = useState('USED_EXCELLENT');
  const [categoryId, setCategoryId] = useState('');
  const [categoryQuery, setCategoryQuery] = useState('');
  const [categories, setCategories] = useState<PolicyOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [titleOverride, setTitleOverride] = useState('');
  const [bestOffer, setBestOffer] = useState<boolean | null>(null);
  const [gallery, setGallery] = useState(0);
  const [adRate, setAdRate] = useState('');

  const [preview, setPreview] = useState<EbayPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [allPhotos, setAllPhotos] = useState<string[]>([]);
  const [hasListingPhotos, setHasListingPhotos] = useState(false);

  const [orders, setOrders] = useState<EbayOrder[]>([]);
  const [fixOpen, setFixOpen] = useState(false);
  const [editing, setEditing] = useState<{ key: string; value: string } | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [despatch, setDespatch] = useState<{ id: string; carrier: string; tracking: string } | null>(null);

  const runPreview = useCallback(async () => {
    setPreviewing(true);
    try {
      setPreview(await previewBikeOnEbay(bikeId));
      setPreviewError(null);
    } catch (e) {
      setPreviewError((e as Error).message);
    } finally {
      setPreviewing(false);
    }
  }, [bikeId]);

  const load = useCallback(async () => {
    try {
      const status = await getEbayStatus();
      setConnected(status.connected);
      setCanManage(Boolean(status.can_manage));
      if (status.connected) {
        setDefaults({
          condition: status.condition || 'USED_EXCELLENT',
          category_id: status.category_id || '177831',
          best_offer: Boolean(status.best_offer_enabled),
        });
        const row = await getBikeEbayListing(bikeId);
        setListing(row);
        setCondition(row?.condition || status.condition || 'USED_EXCELLENT');
        setCategoryId(row?.category_id || '');
        setTitleOverride(row?.title_override || '');
        setBestOffer(row?.best_offer_enabled ?? null);
        setGallery(row?.gallery_photo_index ?? 0);
        setAdRate(row?.ad_rate != null ? String(row.ad_rate) : '');
        const { data: b } = await supabase.from('bikes').select('photos, listing_photos').eq('id', bikeId).maybeSingle();
        const bikeImages = (b as any) ?? {};
        const dedicated = Array.isArray(bikeImages.listing_photos) && bikeImages.listing_photos.length > 0;
        setHasListingPhotos(dedicated);
        setAllPhotos(effectiveListingImages(bikeImages));
        if (dedicated) setGallery(0);
        setOrders(await getBikeEbayOrders(bikeId));
        void runPreview();
      }
    } catch {
      setConnected(false);
    } finally {
      setLoading(false);
    }
  }, [bikeId, runPreview]);

  // Reload when the bike changes (photos uploaded, details edited) — quietly, no spinner.
  useEffect(() => { load(); }, [load, refreshKey]);

  const options = () => ({
    condition,
    category_id: categoryId.trim() || null,
    title_override: titleOverride.trim() || null,
    best_offer_enabled: bestOffer,
    gallery_photo_index: hasListingPhotos ? 0 : gallery,
    ...(canManage ? { ad_rate: adRate.trim() ? Number(adRate) : null } : {}),
  });

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

  const openDespatch = async (order: EbayOrder) => {
    let tracking = '';
    const { data } = await supabase
      .from('bike_collections')
      .select('tracking_number, order_id')
      .eq('bike_id', bikeId)
      .eq('direction', 'outbound')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) tracking = (data as any).tracking_number || (data as any).order_id || '';
    setDespatch({ id: order.id, carrier: tracking ? 'Other' : '', tracking });
  };

  const FIELD: Record<string, string> = { price: 'asking_price', type: 'bike_type', condition_notes: 'condition_notes', listing_description: 'listing_description' };

  const openEdit = async (key: string) => {
    if (FIELD[key]) {
      if (editing?.key === key) { setEditing(null); return; }
      const { data } = await supabase.from('bikes').select(FIELD[key]).eq('id', bikeId).maybeSingle();
      const v = (data as any)?.[FIELD[key]];
      setEditing({ key, value: v == null ? '' : String(v) });
      return;
    }
    const scrollTo = (id: string) => {
      const el = document.getElementById(id);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (el instanceof HTMLInputElement) setTimeout(() => el.focus(), 300);
    };
    if (key === 'title') scrollTo(`ebay-title-${bikeId}`);
    else if (key === 'category' || key === 'condition') scrollTo(`ebay-cat-${bikeId}`);
    else if (key === 'photos') scrollTo('listing-images-section');
    else if (key.startsWith('specifics')) setFixOpen(true);
    else if (key === 'policies' || key === 'location') window.open('/settings', '_blank');
  };

  const [genSeed, setGenSeed] = useState(0);
  const writeDescription = async () => {
    if (!editing) return;
    if (editing.value.trim() && !window.confirm('Replace the current description with a new draft?')) return;
    const { data: b } = await supabase.from('bikes').select('*').eq('id', bikeId).maybeSingle();
    let parts: any[] = [];
    try { parts = await fetchBikeComponents(supabase, bikeId); } catch { /* write from bike details only */ }
    const text = generateDescription({ bike: b, parts, seed: genSeed });
    setGenSeed((n) => n + 1);
    setEditing({ key: 'listing_description', value: text });
  };

  const saveEdit = async () => {
    if (!editing) return;
    const col = FIELD[editing.key];
    let value: unknown = editing.value.trim() || null;
    if (col === 'asking_price') {
      const n = Number(editing.value);
      if (!editing.value.trim() || !Number.isFinite(n) || n <= 0) { toast.error('Enter a price above £0'); return; }
      value = n;
    }
    setSavingEdit(true);
    const { error, count } = await supabase.from('bikes').update({ [col]: value } as any, { count: 'exact' }).eq('id', bikeId);
    setSavingEdit(false);
    if (error || count === 0) { toast.error(error?.message || "Couldn't save — you may not have permission"); return; }
    toast.success('Saved');
    setEditing(null);
    void runPreview();
  };

  if (loading || !connected) return null;

  const shownTitle = titleOverride.trim() || preview?.built_title || '';
  const blocked = preview ? !preview.can_publish : false;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Tag className="h-4 w-4 text-muted-foreground" /> eBay
          </CardTitle>
          <div className="flex flex-wrap gap-2">
            {listing?.ad_id && listing?.ad_rate != null && <Badge variant="outline">Promoted at {listing.ad_rate}%</Badge>}
            {preview?.promotion.enabled && !listing?.ad_id && <Badge variant="outline">Will promote at {preview.promotion.rate}%</Badge>}
            <Badge variant={listing?.status === 'listed' ? 'default' : 'secondary'}>
              {LABELS[listing?.status ?? 'not_listed'] ?? listing?.status}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Title */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label>Title</Label>
            <span className={`text-xs ${shownTitle.length > EBAY_TITLE_MAX ? 'text-destructive' : 'text-muted-foreground'}`}>
              {shownTitle.length}/{EBAY_TITLE_MAX}
            </span>
          </div>
          <p className="rounded border bg-muted/40 px-2 py-1.5 text-sm">{shownTitle || '—'}</p>
          <Input
            id={`ebay-title-${bikeId}`}
            value={titleOverride}
            maxLength={EBAY_TITLE_MAX}
            onChange={(e) => setTitleOverride(e.target.value)}
            placeholder="Custom title for this bike (leave blank to build it automatically)"
          />
        </div>

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
              placeholder={preview && preview.category_source === 'type' ? `From bike type: ${preview.category_id}` : `Default ${defaults.category_id}`}
            />
          </div>
        </div>

        <div className="space-y-2 rounded border p-3">
          <Label htmlFor={`ebay-cat-search-${bikeId}`} className="text-xs">Find a category</Label>
          <div className="flex gap-2">
            <Input id={`ebay-cat-search-${bikeId}`} value={categoryQuery} onChange={(e) => setCategoryQuery(e.target.value)} placeholder="mountain bike" />
            <Button variant="outline" onClick={handleSearch} disabled={searching} aria-label="Search categories">
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>
          {categories.length > 0 && (
            <div className="space-y-1">
              {categories.map((c) => (
                <button key={c.id} type="button" onClick={() => { setCategoryId(c.id); toast.success('Category selected'); }}
                  className="block w-full rounded px-2 py-1 text-left text-xs hover:bg-muted">
                  {c.name} <span className="text-muted-foreground">({c.id})</span>
                </button>
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground">Leave blank to use the category for this bike type, or your default.</p>
        </div>

        {/* Photos */}
        {allPhotos.length > 0 && (
          <div className="space-y-1.5">
            <Label>Main photo <span className="font-normal text-muted-foreground">({Math.min(allPhotos.length, 24)} of 24 sent)</span></Label>
            {hasListingPhotos && <p className="text-xs text-muted-foreground">The first image in Listing images is used as the main photo.</p>}
            <div className="flex flex-wrap gap-2">
              {allPhotos.slice(0, 24).map((url, i) => {
                const size = preview?.photos.find((p) => p.url === url)?.longest;
                return (
                  <button key={url + i} type="button" onClick={() => { if (!hasListingPhotos) setGallery(i); }} disabled={hasListingPhotos}
                    className={`relative h-14 w-14 overflow-hidden rounded border-2 ${gallery === i ? 'border-primary' : 'border-transparent'}`}
                    aria-label={`Use photo ${i + 1} as main photo`}>
                    <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
                    {size != null && size < 1600 && (
                      <span className={`absolute bottom-0 left-0 right-0 text-[9px] ${size < 500 ? 'bg-destructive text-destructive-foreground' : 'bg-warning text-warning-foreground'}`}>{size}px</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Best Offer + promotion */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex items-center justify-between rounded border p-3">
            <div>
              <Label>Best Offer</Label>
              <p className="text-xs text-muted-foreground">{bestOffer === null ? `Using default (${defaults.best_offer ? 'on' : 'off'})` : 'Set for this bike'}</p>
            </div>
            <Switch checked={bestOffer ?? defaults.best_offer} onCheckedChange={(v) => setBestOffer(v)} />
          </div>
          <div className="space-y-1.5 rounded border p-3">
            <Label htmlFor={`ebay-ad-${bikeId}`}>Ad rate for this bike (%)</Label>
            <Input id={`ebay-ad-${bikeId}`} type="number" min={2} max={100} step={0.1} value={adRate}
              onChange={(e) => setAdRate(e.target.value)} disabled={!canManage}
              placeholder={preview?.promotion.rate != null ? `Default ${preview.promotion.rate}%` : 'Not promoted'} />
          </div>
        </div>

        {/* Checklist */}
        <div className="space-y-2 rounded border p-3">
          <div className="flex items-center justify-between">
            <Label>Before you list</Label>
            <Button size="sm" variant="ghost" onClick={runPreview} disabled={previewing}>
              {previewing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              <span className="ml-1">Check again</span>
            </Button>
          </div>
          {previewError && <p className="text-xs text-destructive">{previewError}</p>}
          {preview?.checklist.map((c) => {
            const clickable = EDITABLE.has(c.key);
            return (
              <div key={c.key} className="space-y-2">
                <button type="button" disabled={!clickable} onClick={() => openEdit(c.key)}
                  className={`flex w-full gap-2 rounded text-left text-sm ${clickable ? 'cursor-pointer hover:bg-muted/50' : 'cursor-default'}`}>
                  <LevelIcon level={c.level} />
                  <div className="min-w-0 flex-1">
                    <p className={clickable ? 'underline decoration-dotted underline-offset-2' : ''}>{c.label}</p>
                    {c.detail && c.key !== 'mobile' && <p className="break-words text-xs text-muted-foreground">{c.detail}</p>}
                    {c.key === 'mobile' && c.detail && (
                      <p className="mt-1 max-h-24 overflow-auto rounded bg-muted/40 p-2 text-xs text-muted-foreground">{c.detail}</p>
                    )}
                  </div>
                  {clickable && <Pencil className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                </button>
                {editing?.key === c.key && (
                  <div className="ml-6 space-y-2 rounded border bg-muted/30 p-2">
                    {editing.key === 'price' ? (
                      <Input type="number" min={0} step="1" autoFocus value={editing.value}
                        onChange={(e) => setEditing({ ...editing, value: e.target.value })} placeholder="Asking price (£)" />
                    ) : editing.key === 'type' ? (
                      <Input autoFocus value={editing.value} onChange={(e) => setEditing({ ...editing, value: e.target.value })} placeholder="e.g. Road, Gravel, Mountain" />
                    ) : (
                      <Textarea autoFocus rows={editing.key === 'listing_description' ? 8 : 4} value={editing.value}
                        onChange={(e) => setEditing({ ...editing, value: e.target.value })}
                        placeholder={editing.key === 'listing_description' ? 'Bike description (also used as the Shopify Body)' : 'Condition notes'} />
                    )}
                    <div className="flex gap-2">
                      <Button size="sm" onClick={saveEdit} disabled={savingEdit}>
                        {savingEdit && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
                      {editing.key === 'listing_description' && (
                        <Button size="sm" variant="outline" className="ml-auto" onClick={writeDescription} type="button">
                          <Wand2 className="mr-2 h-4 w-4" />{genSeed ? 'Try another' : 'Write for me'}
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          <p className="text-xs text-muted-foreground">Red items stop the listing. Amber items are advice. Save options, then check again.</p>
        </div>

        {listing?.last_synced_at && (
          <p className="text-xs text-muted-foreground">Last updated {new Date(listing.last_synced_at).toLocaleString()}</p>
        )}
        {listing?.last_error && <p className="text-xs text-destructive">{listing.last_error}</p>}
        {(listing?.last_error || preview?.checklist.some((c) => c.level === 'block')) && (
          <Button size="sm" variant="destructive" onClick={() => setFixOpen(true)}>
            <AlertTriangle className="mr-2 h-4 w-4" /> Fix problems
          </Button>
        )}
        <FixListingProblemsDialog bikeId={bikeId} open={fixOpen} onOpenChange={setFixOpen}
          onDone={() => { void load(); void runPreview(); }} />
        {listing?.condition_substituted_from && listing?.condition_substituted_to && (
          <div className="rounded border border-warning/50 bg-warning/10 p-2 text-xs">
            <Badge variant="outline" className="mr-2 border-warning text-warning">Condition changed</Badge>
            eBay didn't accept "{conditionName(listing.condition_substituted_from)}" in this category, so it's listed as "{conditionName(listing.condition_substituted_to)}".
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled={busy !== null}
            onClick={() => run('save', async () => { await saveBikeEbayOptions(bikeId, options()); }, 'Saved for this bike')}>
            {busy === 'save' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save options
          </Button>
          <Button size="sm" disabled={busy !== null || blocked}
            onClick={() => run('list', async () => {
              await saveBikeEbayOptions(bikeId, options());
              const result = await listBikeOnEbay(bikeId);
              (result.warnings ?? []).forEach((w) => toast.warning(w));
            }, listing?.offer_id ? 'eBay listing updated' : 'Bike listed on eBay')}>
            {busy === 'list' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {listing?.offer_id ? 'Update listing' : 'List on eBay'}
          </Button>
          {listing?.offer_id && (
            <>
              <Button size="sm" variant="outline" disabled={busy !== null}
                onClick={() => run('end', () => endBikeOnEbay(bikeId), 'eBay listing ended')}>
                {busy === 'end' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                End listing
              </Button>
              <Button size="sm" variant="outline" disabled={busy !== null}
                onClick={() => run('remove', () => removeBikeFromEbay(bikeId), 'Removed from eBay')}>
                {busy === 'remove' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Remove
              </Button>
              {listing.listing_url && (
                <Button size="sm" variant="ghost" asChild>
                  <a href={listing.listing_url} target="_blank" rel="noreferrer">View <ExternalLink className="ml-1 h-3 w-3" /></a>
                </Button>
              )}
            </>
          )}
        </div>

        {/* eBay orders */}
        {orders.length > 0 && (
          <div className="space-y-2 rounded border p-3">
            <Label>eBay orders</Label>
            {orders.map((o) => (
              <div key={o.id} className="space-y-2 border-t pt-2 text-sm first:border-t-0 first:pt-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    {o.order_id} · {o.buyer_username ?? 'buyer'} · {o.currency === 'GBP' ? '£' : `${o.currency ?? ''} `}{Number(o.total ?? 0).toLocaleString('en-GB')}
                  </span>
                  {o.status === 'despatched'
                    ? <Badge variant="secondary">Despatched {o.carrier} {o.tracking_number}</Badge>
                    : <Button size="sm" variant="outline" onClick={() => openDespatch(o)}><Truck className="mr-1 h-4 w-4" /> Mark despatched</Button>}
                </div>
                {despatch?.id === o.id && (
                  <div className="flex flex-wrap gap-2">
                    <Input className="w-36" placeholder="Carrier (e.g. RoyalMail)" value={despatch.carrier}
                      onChange={(e) => setDespatch({ ...despatch, carrier: e.target.value })} />
                    <Input className="w-48" placeholder="Tracking number" value={despatch.tracking}
                      onChange={(e) => setDespatch({ ...despatch, tracking: e.target.value })} />
                    <Button size="sm" disabled={busy !== null}
                      onClick={() => run('despatch', async () => {
                        await markEbayOrderDespatched(despatch.id, despatch.carrier, despatch.tracking);
                        setDespatch(null);
                      }, 'Order marked despatched on eBay')}>
                      {busy === 'despatch' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
