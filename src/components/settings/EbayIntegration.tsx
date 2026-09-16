import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Link2, Unlink, AlertCircle, Tag, Search } from 'lucide-react';
import { toast } from 'sonner';
import {
  getEbayStatus,
  getEbayAuthUrl,
  disconnectEbay,
  saveEbaySettings,
  getEbayPolicies,
  searchEbayCategories,
  type EbayStatus,
  type PolicyOption,
} from '@/services/ebay';

const CONDITIONS = [
  { value: 'NEW', label: 'New' },
  { value: 'USED_EXCELLENT', label: 'Used — excellent' },
  { value: 'USED_VERY_GOOD', label: 'Used — very good' },
  { value: 'USED_GOOD', label: 'Used — good' },
  { value: 'USED_ACCEPTABLE', label: 'Used — acceptable' },
  { value: 'FOR_PARTS_OR_NOT_WORKING', label: 'For parts or not working' },
];

export default function EbayIntegration() {
  const [status, setStatus] = useState<EbayStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [environment, setEnvironment] = useState<'sandbox' | 'production'>('sandbox');
  const [autoList, setAutoList] = useState(true);
  const [categoryId, setCategoryId] = useState('');
  const [condition, setCondition] = useState('USED_EXCELLENT');
  const [postcode, setPostcode] = useState('');
  const [fulfillment, setFulfillment] = useState('');
  const [payment, setPayment] = useState('');
  const [returns, setReturns] = useState('');
  const [policies, setPolicies] = useState<{ fulfillment: PolicyOption[]; payment: PolicyOption[]; returns: PolicyOption[] }>({
    fulfillment: [], payment: [], returns: [],
  });
  const [categoryQuery, setCategoryQuery] = useState('');
  const [categories, setCategories] = useState<PolicyOption[]>([]);
  const [searchingCategories, setSearchingCategories] = useState(false);

  const load = useCallback(async () => {
    try {
      const result = await getEbayStatus();
      setStatus(result);
      setEnvironment(result.environment);
      setAutoList(result.auto_list);
      setCategoryId(result.category_id || '');
      setCondition(result.condition || 'USED_EXCELLENT');
      setPostcode(result.postcode || '');
      setFulfillment(result.fulfillment_policy_id || '');
      setPayment(result.payment_policy_id || '');
      setReturns(result.return_policy_id || '');
      setError(null);
      if (result.connected) {
        try {
          setPolicies(await getEbayPolicies());
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
    const result = params.get('ebay');
    if (!result) return;
    if (result === 'connected') toast.success('eBay connected');
    if (result === 'error') toast.error(`eBay could not be connected: ${params.get('message') ?? ''}`);
    params.delete('ebay');
    params.delete('message');
    const qs = params.toString();
    window.history.replaceState({}, '', `${window.location.pathname}${qs ? `?${qs}` : ''}`);
    load();
  }, [load]);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const { url } = await getEbayAuthUrl(environment);
      window.location.href = url;
    } catch (e) {
      toast.error((e as Error).message);
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnectEbay();
      toast.success('eBay disconnected');
      load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveEbaySettings({
        auto_list: autoList,
        category_id: categoryId,
        condition,
        postcode,
        fulfillment_policy_id: fulfillment,
        payment_policy_id: payment,
        return_policy_id: returns,
      });
      toast.success('eBay settings saved');
      load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleCategorySearch = async () => {
    setSearchingCategories(true);
    try {
      const { categories: list } = await searchEbayCategories(categoryQuery || 'bicycle');
      setCategories(list);
      if (!list.length) toast.info('No matching eBay categories found');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSearchingCategories(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Tag className="h-5 w-5 text-muted-foreground" />
            <CardTitle>eBay</CardTitle>
          </div>
          {!loading && (
            <Badge variant={status?.connected ? 'default' : 'secondary'}>
              {status?.connected ? `Connected (${status.environment === 'production' ? 'live' : 'sandbox'})` : 'Not connected'}
            </Badge>
          )}
        </div>
        <CardDescription>
          List bikes on your own eBay account automatically and end the listing when they sell elsewhere.
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
              <div className="font-medium">{status.seller_name || 'eBay seller account'}</div>
              <div className="text-muted-foreground">
                {status.environment === 'production' ? 'Live marketplace' : 'Sandbox (test) marketplace'}
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
              <div>
                <div className="text-sm font-medium">List bikes automatically</div>
                <div className="text-xs text-muted-foreground">
                  Puts a bike on eBay as soon as it is ready for sale.
                </div>
              </div>
              <Switch checked={autoList} onCheckedChange={setAutoList} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Postage policy</Label>
                <Select value={fulfillment} onValueChange={setFulfillment}>
                  <SelectTrigger><SelectValue placeholder="Choose a policy" /></SelectTrigger>
                  <SelectContent className="max-h-[280px] overflow-y-auto">
                    {policies.fulfillment.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Payment policy</Label>
                <Select value={payment} onValueChange={setPayment}>
                  <SelectTrigger><SelectValue placeholder="Choose a policy" /></SelectTrigger>
                  <SelectContent className="max-h-[280px] overflow-y-auto">
                    {policies.payment.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Returns policy</Label>
                <Select value={returns} onValueChange={setReturns}>
                  <SelectTrigger><SelectValue placeholder="Choose a policy" /></SelectTrigger>
                  <SelectContent className="max-h-[280px] overflow-y-auto">
                    {policies.returns.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
                <Label htmlFor="ebay-postcode">Despatch postcode</Label>
                <Input
                  id="ebay-postcode"
                  value={postcode}
                  onChange={(e) => setPostcode(e.target.value)}
                  placeholder="BN1 1AA"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ebay-category">eBay category number</Label>
                <Input
                  id="ebay-category"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  placeholder="177831"
                />
              </div>
            </div>

            <div className="space-y-2 rounded-lg border p-3">
              <Label htmlFor="ebay-category-search" className="text-xs">Find a category</Label>
              <div className="flex gap-2">
                <Input
                  id="ebay-category-search"
                  value={categoryQuery}
                  onChange={(e) => setCategoryQuery(e.target.value)}
                  placeholder="mountain bike"
                />
                <Button variant="outline" onClick={handleCategorySearch} disabled={searchingCategories}>
                  {searchingCategories ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
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
            </div>

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
              <Label>Marketplace</Label>
              <Select value={environment} onValueChange={(v) => setEnvironment(v as 'sandbox' | 'production')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sandbox">Sandbox (testing)</SelectItem>
                  <SelectItem value="production">Live eBay</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleConnect} disabled={connecting}>
              {connecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Link2 className="mr-2 h-4 w-4" />}
              Connect eBay
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
