import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Wand2, AlertCircle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { BIKE_TYPES } from '@/lib/bikeSpec';
import { saveEbayListingSettings, suggestEbayCategory, syncEbayOrders, type EbayStatus } from '@/services/ebay';

interface Props {
  status: EbayStatus;
  onReconnect: () => void;
}

/** Category per bike type, Best Offer, Promoted Listings and sale sync. */
export default function EbayListingSettings({ status, onReconnect }: Props) {
  const [byType, setByType] = useState<Record<string, string>>(status.category_by_type ?? {});
  const [bestOffer, setBestOffer] = useState(Boolean(status.best_offer_enabled));
  const [accept, setAccept] = useState(String(status.best_offer_accept_pct ?? 95));
  const [decline, setDecline] = useState(String(status.best_offer_decline_pct ?? 80));
  const [promote, setPromote] = useState(Boolean(status.promote_enabled));
  const [promoteAuto, setPromoteAuto] = useState(Boolean(status.promote_auto));
  const [adRate, setAdRate] = useState(String(status.ad_rate ?? 5));
  const [saving, setSaving] = useState(false);
  const [suggesting, setSuggesting] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const suggest = async (type: string, label: string) => {
    setSuggesting(type);
    try {
      const { category } = await suggestEbayCategory(`${label} bike`);
      if (category) {
        setByType((m) => ({ ...m, [type]: category.id }));
        toast.success(`${label}: ${category.name}`);
      } else toast.info('No suggestion from eBay');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSuggesting(null);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      await saveEbayListingSettings({
        category_by_type: byType,
        best_offer_enabled: bestOffer,
        best_offer_accept_pct: Number(accept),
        best_offer_decline_pct: Number(decline),
        promote_enabled: promote,
        promote_auto: promoteAuto,
        ad_rate: Number(adRate),
      });
      toast.success('Listing settings saved');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const sync = async () => {
    setSyncing(true);
    try {
      const r = await syncEbayOrders();
      const res = (r.results?.[0] ?? {}) as { processed?: number; error?: string; skipped?: string };
      if (res.error) toast.error(res.error);
      else toast.success(`Checked eBay — ${res.processed ?? 0} new order(s)`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-5 border-t pt-5">
      {status.needs_reconnect && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            Reconnect eBay to enable sale sync and promotion.
            <Button size="sm" onClick={onReconnect}>Reconnect eBay</Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <p className="text-sm font-medium">Category for each bike type</p>
        <p className="text-xs text-muted-foreground">
          A bike's own category wins, then its type's category here, then your default category.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {BIKE_TYPES.map((t) => (
            <div key={t.value} className="flex items-center gap-2">
              <Label className="w-40 shrink-0 text-xs">{t.label}</Label>
              <Input
                value={byType[t.value] ?? ''}
                onChange={(e) => setByType((m) => ({ ...m, [t.value]: e.target.value.replace(/\D/g, '') }))}
                placeholder="Default"
                inputMode="numeric"
              />
              <Button size="icon" variant="ghost" onClick={() => suggest(t.value, t.label)} disabled={suggesting !== null} aria-label={`Suggest category for ${t.label}`}>
                {suggesting === t.value ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
              </Button>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Best Offer</p>
            <p className="text-xs text-muted-foreground">Default for new listings — can be switched per bike.</p>
          </div>
          <Switch checked={bestOffer} onCheckedChange={setBestOffer} />
        </div>
        {bestOffer && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Auto-accept at (% of asking price)</Label>
              <Input type="number" min={1} max={100} value={accept} onChange={(e) => setAccept(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Auto-decline below (% of asking price)</Label>
              <Input type="number" min={1} max={100} value={decline} onChange={(e) => setDecline(e.target.value)} />
            </div>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Promoted Listings</p>
            <p className="text-xs text-muted-foreground">You only pay the ad rate when a promoted bike sells.</p>
          </div>
          <Switch checked={promote} onCheckedChange={setPromote} />
        </div>
        {promote && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Default ad rate (%)</Label>
              <Input type="number" min={2} max={100} step={0.1} value={adRate} onChange={(e) => setAdRate(e.target.value)} />
            </div>
            <div className="flex items-center justify-between rounded border p-3">
              <Label>Promote every new listing</Label>
              <Switch checked={promoteAuto} onCheckedChange={setPromoteAuto} />
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={save} disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save listing settings
        </Button>
        <Button variant="outline" onClick={sync} disabled={syncing}>
          {syncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Check for eBay sales now
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        eBay sales are checked every 5 minutes. A sold bike is marked sold here and taken off Shopify automatically.
      </p>
    </div>
  );
}
