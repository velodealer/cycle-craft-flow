import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import PhotoUpload from '@/components/PhotoUpload';
import { toast } from 'sonner';
import { ExternalLink, Loader2 } from 'lucide-react';
import { partReadiness, partTitle } from '../../../supabase/functions/_shared/part-listing-rules';

const CONDITIONS = [
  ['NEW', 'New'],
  ['NEW_OTHER', 'New (other / open box)'],
  ['USED_EXCELLENT', 'Used'],
  ['USED_GOOD', 'Used – good'],
  ['USED_ACCEPTABLE', 'Used – acceptable'],
  ['FOR_PARTS_OR_NOT_WORKING', 'For parts / not working'],
];

interface Props {
  partId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onChanged: () => void;
}

async function invokeErr(error: any) {
  try { const t = await error?.context?.text?.(); if (t) return JSON.parse(t).error ?? t; } catch { /* fall through */ }
  return error?.message ?? 'Something went wrong';
}

export default function PartListingDialog({ partId, open, onOpenChange, onChanged }: Props) {
  const [part, setPart] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    if (!partId) return;
    const { data, error } = await supabase.from('parts').select('*').eq('id', partId).maybeSingle();
    if (error) toast.error(error.message);
    setPart(data);
  };
  useEffect(() => { if (open) load(); else setPart(null); }, [open, partId]);

  const set = (patch: Record<string, unknown>) => setPart((p: any) => ({ ...p, ...patch }));

  const save = async (extra: Record<string, unknown> = {}) => {
    if (!part) return false;
    setSaving(true);
    const patch = {
      for_sale: part.for_sale,
      listing_title: part.listing_title?.trim() || null,
      listing_description: part.listing_description?.trim() || null,
      listing_condition: part.listing_condition,
      listing_photos: part.listing_photos ?? [],
      ebay_category_id: part.ebay_category_id?.trim() || null,
      sale_price: part.sale_price === '' || part.sale_price == null ? null : Number(part.sale_price),
      ...extra,
    };
    const { error } = await supabase.from('parts').update(patch as any).eq('id', part.id);
    setSaving(false);
    if (error) { toast.error(`Could not save: ${error.message}`); return false; }
    onChanged();
    return true;
  };

  const run = async (channel: 'ebay' | 'shopify', action: 'list' | 'end') => {
    if (!(await save())) return;
    setBusy(`${channel}-${action}`);
    const { error } = await supabase.functions.invoke('sync-part-listing', { body: { part_id: part.id, channel, action } });
    setBusy(null);
    const name = channel === 'ebay' ? 'eBay' : 'Shopify';
    if (error) toast.error(`${name}: ${await invokeErr(error)}`);
    else toast.success(action === 'list' ? `Listed on ${name}` : `Taken off ${name}`);
    await load();
    onChanged();
  };

  const blockers = part ? partReadiness({ ...part, sale_price: Number(part.sale_price) }) : [];
  const ready = blockers.length === 0;

  const channelRow = (channel: 'ebay' | 'shopify') => {
    const name = channel === 'ebay' ? 'eBay' : 'Shopify';
    const status = part[`${channel}_listing_status`];
    const url = channel === 'ebay' ? part.ebay_listing_url : part.shopify_product_url;
    const err = part[`${channel}_last_error`];
    const live = status === 'listed';
    return (
      <div className="rounded-md border p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-medium">{name}</span>
            <Badge variant={live ? 'default' : 'secondary'}>{status ? status.replace('_', ' ') : 'not listed'}</Badge>
          </div>
          {url && (
            <a href={url} target="_blank" rel="noreferrer" className="text-sm text-primary inline-flex items-center gap-1">
              View <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
        {err && <p className="text-sm text-destructive break-words">{err}</p>}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={!ready || !!busy || part.stock_status !== 'in_stock'} onClick={() => run(channel, 'list')}>
            {busy === `${channel}-list` && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {live ? `Update on ${name}` : `List on ${name}`}
          </Button>
          {live && (
            <Button size="sm" variant="outline" disabled={!!busy} onClick={() => run(channel, 'end')}>
              {busy === `${channel}-end` && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Take off {name}
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">Photos & listing</DialogTitle>
          <DialogDescription>{part ? partTitle(part) : 'Loading…'}</DialogDescription>
        </DialogHeader>
        {!part ? (
          <div className="py-10 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : (
          <div className="space-y-5">
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <Label htmlFor="for-sale" className="font-medium">For sale online</Label>
                <p className="text-sm text-muted-foreground">Only ticked parts can go on eBay and Shopify.</p>
              </div>
              <Switch id="for-sale" checked={!!part.for_sale} onCheckedChange={(v) => set({ for_sale: v })} />
            </div>

            <div className="space-y-2">
              <Label>Photos</Label>
              <p className="text-sm text-muted-foreground">The first photo is the main one. Drag to reorder.</p>
              <PhotoUpload
                bucket="bike-photos"
                path={`${part.business_id}/parts/${part.id}`}
                photos={part.listing_photos ?? []}
                onChange={(photos: string[]) => set({ listing_photos: photos })}
                maxPhotos={24}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label>Listing title</Label>
                <Input
                  value={part.listing_title ?? ''}
                  placeholder={partTitle({ brand: part.brand, description: part.description })}
                  maxLength={80}
                  onChange={(e) => set({ listing_title: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">Leave blank to use brand and description. eBay allows 80 characters.</p>
              </div>
              <div className="space-y-2">
                <Label>Sale price (£)</Label>
                <Input type="number" inputMode="decimal" step="0.01" value={part.sale_price ?? ''} onChange={(e) => set({ sale_price: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Condition</Label>
                <Select value={part.listing_condition ?? 'USED_EXCELLENT'} onValueChange={(v) => set({ listing_condition: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CONDITIONS.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Description</Label>
                <Textarea rows={5} value={part.listing_description ?? ''} placeholder={part.description} onChange={(e) => set({ listing_description: e.target.value })} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>eBay category number (optional)</Label>
                <Input inputMode="numeric" value={part.ebay_category_id ?? ''} placeholder="Picked automatically" onChange={(e) => set({ ebay_category_id: e.target.value.replace(/\D/g, '') })} />
              </div>
            </div>

            {!ready && (
              <ul className="text-sm text-muted-foreground list-disc pl-5">
                {blockers.map((b) => <li key={b}>{b}</li>)}
              </ul>
            )}

            <div className="space-y-3">
              {channelRow('ebay')}
              {channelRow('shopify')}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
              <Button disabled={saving} onClick={async () => { if (await save()) toast.success('Saved'); }}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Save
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
