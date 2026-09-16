import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Link2, Unlink, AlertCircle, ShoppingBag } from 'lucide-react';
import { toast } from 'sonner';
import {
  getShopifyStatus,
  getShopifyAuthUrl,
  disconnectShopify,
  saveShopifySettings,
  listShopifyLocations,
  type ShopifyStatus,
} from '@/services/shopify';

export default function ShopifyIntegration() {
  const [status, setStatus] = useState<ShopifyStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shopDomain, setShopDomain] = useState('');
  const [autoList, setAutoList] = useState(true);
  const [productType, setProductType] = useState('Bicycle');
  const [vendor, setVendor] = useState('');
  const [locationId, setLocationId] = useState<string>('');
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([]);

  const load = useCallback(async () => {
    try {
      const result = await getShopifyStatus();
      setStatus(result);
      setAutoList(result.auto_list);
      setProductType(result.product_type || 'Bicycle');
      setVendor(result.vendor || '');
      setLocationId(result.location_id || '');
      setError(null);
      if (result.connected) {
        try {
          const { locations: list } = await listShopifyLocations();
          setLocations(list);
        } catch { /* non-fatal */ }
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const result = params.get('shopify');
    if (!result) return;
    if (result === 'connected') toast.success('Shopify connected');
    if (result === 'error') toast.error(`Shopify could not be connected: ${params.get('message') ?? ''}`);
    params.delete('shopify');
    params.delete('message');
    const qs = params.toString();
    window.history.replaceState({}, '', `${window.location.pathname}${qs ? `?${qs}` : ''}`);
    load();
  }, [load]);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const { url } = await getShopifyAuthUrl(shopDomain);
      window.location.href = url;
    } catch (e) {
      toast.error((e as Error).message);
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnectShopify();
      toast.success('Shopify disconnected');
      load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveShopifySettings({
        auto_list: autoList,
        product_type: productType,
        vendor,
        location_id: locationId || null,
      });
      toast.success('Shopify settings saved');
      load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Shopify</CardTitle>
          </div>
          {!loading && (
            <Badge variant={status?.connected ? 'default' : 'secondary'}>
              {status?.connected ? 'Connected' : 'Not connected'}
            </Badge>
          )}
        </div>
        <CardDescription>
          Put bikes on your own Shopify store automatically and set their stock to zero when they sell elsewhere.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : error ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : status?.connected ? (
          <>
            <div className="text-sm">
              <div className="font-medium">{status.shop_name}</div>
              <div className="text-muted-foreground break-all">{status.shop_domain}</div>
            </div>

            <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
              <div>
                <div className="text-sm font-medium">List bikes automatically</div>
                <div className="text-xs text-muted-foreground">
                  Adds a bike to Shopify as soon as it is ready for sale.
                </div>
              </div>
              <Switch checked={autoList} onCheckedChange={setAutoList} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="shopify-product-type">Product type</Label>
                <Input
                  id="shopify-product-type"
                  value={productType}
                  onChange={(e) => setProductType(e.target.value)}
                  placeholder="Bicycle"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="shopify-vendor">Vendor wording</Label>
                <Input
                  id="shopify-vendor"
                  value={vendor}
                  onChange={(e) => setVendor(e.target.value)}
                  placeholder="Leave blank to use the bike's brand"
                />
              </div>
            </div>

            {locations.length > 0 && (
              <div className="space-y-1.5">
                <Label>Stock location</Label>
                <Select value={locationId} onValueChange={setLocationId}>
                  <SelectTrigger><SelectValue placeholder="Choose a location" /></SelectTrigger>
                  <SelectContent className="max-h-[280px] overflow-y-auto">
                    {locations.map((l) => (
                      <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save settings
              </Button>
              <Button variant="outline" onClick={handleDisconnect}>
                <Unlink className="mr-2 h-4 w-4" /> Disconnect
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="shopify-shop">Your store address</Label>
              <Input
                id="shopify-shop"
                value={shopDomain}
                onChange={(e) => setShopDomain(e.target.value)}
                placeholder="my-shop.myshopify.com"
              />
            </div>
            <Button onClick={handleConnect} disabled={connecting || !shopDomain.trim()}>
              {connecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Link2 className="mr-2 h-4 w-4" />}
              Connect Shopify
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
