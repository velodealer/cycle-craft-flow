import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Tags } from 'lucide-react';
import { useListingChannels } from '@/hooks/useListingChannels';
import { applyChannelMarkup, applyTitleAffixes, type Channel, type ListingChannelSettings as S, type Rounding } from '@/lib/channelPricing';

const CHANNELS: { id: Channel; label: string }[] = [
  { id: 'ebay', label: 'eBay' },
  { id: 'shopify', label: 'Shopify' },
  { id: 'squarespace', label: 'Squarespace' },
];

export default function ListingChannelSettings() {
  const { settings, loading, error, save } = useListingChannels();
  const [draft, setDraft] = useState<S>(settings);
  const [saving, setSaving] = useState(false);
  useEffect(() => setDraft(settings), [settings]);

  const submit = async () => {
    setSaving(true);
    try { await save(draft); toast.success('Listing settings saved'); }
    catch (e: any) { toast.error(`Could not save: ${e.message}`); }
    finally { setSaving(false); }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Tags className="h-5 w-5" /> Listing channels</CardTitle>
        <CardDescription>Export CSV files for sites you haven't connected, and add a mark-up for sites that charge higher fees.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="space-y-3">
          {(['ebay', 'shopify'] as const).map((c) => (
            <div key={c} className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <Label htmlFor={`manual-${c}`}>{c === 'ebay' ? 'eBay' : 'Shopify'} manual listing</Label>
                <p className="text-xs text-muted-foreground">Shows an "Export {c === 'ebay' ? 'eBay' : 'Shopify'} CSV" button on the Listings page with each bike's full details, ready to upload.</p>
              </div>
              <Switch id={`manual-${c}`} disabled={loading} checked={draft.manual[c]}
                onCheckedChange={(v) => setDraft({ ...draft, manual: { ...draft.manual, [c]: v } })} />
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium">Price mark-up per site</p>
          <p className="text-xs text-muted-foreground">Added on top of the asking price when listing or exporting. Your asking price and profit figures don't change.</p>
          {CHANNELS.map(({ id, label }) => {
            const r = draft.markups[id];
            const set = (patch: Partial<typeof r>) => setDraft({ ...draft, markups: { ...draft.markups, [id]: { ...r, ...patch } } });
            return (
              <div key={id} className="grid grid-cols-[6rem_1fr_1fr] items-center gap-2 sm:grid-cols-[8rem_8rem_12rem_1fr]">
                <span className="text-sm">{label}</span>
                <div className="relative">
                  <Input type="number" min={0} max={500} step="0.5" disabled={loading} value={r.pct}
                    onChange={(e) => set({ pct: Number(e.target.value) || 0 })} className="pr-7" aria-label={`${label} mark-up percent`} />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
                </div>
                <Select value={r.round} onValueChange={(v) => set({ round: v as Rounding })} disabled={loading}>
                  <SelectTrigger aria-label={`${label} rounding`}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No rounding</SelectItem>
                    <SelectItem value="5">Round up to £5</SelectItem>
                    <SelectItem value="10">Round up to £10</SelectItem>
                    <SelectItem value="99">End in .99</SelectItem>
                  </SelectContent>
                </Select>
                <span className="col-span-3 text-xs text-muted-foreground sm:col-span-1">£2,000 → £{applyChannelMarkup(2000, r)?.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</span>
              </div>
            );
          })}
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium">Listing title prefix &amp; suffix</p>
          <p className="text-xs text-muted-foreground">Added around each bike's title when listing or exporting — e.g. a prefix of "BPS Certified" or a suffix of "Free UK Delivery". eBay titles are capped at 80 characters; if it gets too long, the middle of the title is shortened so your prefix and suffix always stay.</p>
          {CHANNELS.map(({ id, label }) => {
            const a = draft.affixes[id];
            const set = (patch: Partial<typeof a>) => setDraft({ ...draft, affixes: { ...draft.affixes, [id]: { ...a, ...patch } } });
            const max = id === 'ebay' ? 80 : 255;
            return (
              <div key={id} className="space-y-1">
                <div className="grid grid-cols-[6rem_1fr_1fr] items-center gap-2 sm:grid-cols-[8rem_1fr_1fr]">
                  <span className="text-sm">{label}</span>
                  <Input placeholder="Prefix" maxLength={40} disabled={loading} value={a.prefix}
                    onChange={(e) => set({ prefix: e.target.value })} aria-label={`${label} title prefix`} />
                  <Input placeholder="Suffix" maxLength={40} disabled={loading} value={a.suffix}
                    onChange={(e) => set({ suffix: e.target.value })} aria-label={`${label} title suffix`} />
                </div>
                {(a.prefix || a.suffix) && (
                  <p className="pl-0 text-xs text-muted-foreground sm:pl-32">
                    Preview: {applyTitleAffixes('Trek Madone SL 6 Disc 56cm 2021', a, max)}{id === 'ebay' ? ` (${applyTitleAffixes('Trek Madone SL 6 Disc 56cm 2021', a, max).length}/80)` : ''}
                  </p>
                )}
              </div>
            );
          })}
        </div>
        <Button onClick={submit} disabled={loading || saving}>{saving ? 'Saving…' : 'Save listing settings'}</Button>
      </CardContent>
    </Card>
  );
}
