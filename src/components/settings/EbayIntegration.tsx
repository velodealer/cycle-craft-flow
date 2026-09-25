import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Link2, Unlink, AlertCircle, Tag, Search, ExternalLink, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import {
  getEbayStatus,
  getEbayAuthUrl,
  disconnectEbay,
  switchEbayMode,
  saveEbaySettings,
  getEbayHeldLocation,
  getEbayPolicies,
  searchEbayCategories,
  type AnyPolicy,
  type EbayPolicies,
  type EbayStatus,
  type PolicyKind,
  type PolicyOption,
} from '@/services/ebay';
import EbayPolicyDialog from './EbayPolicyDialog';
import EbayListingSettings from './EbayListingSettings';

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
  const [city, setCity] = useState('');
  const [locationName, setLocationName] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [held, setHeld] = useState<{ city: string | null; postcode: string | null } | null | undefined>(undefined);
  const [fulfillment, setFulfillment] = useState('');
  const [payment, setPayment] = useState('');
  const [returns, setReturns] = useState('');
  const [policies, setPolicies] = useState<EbayPolicies>({ fulfillment: [], payment: [], returns: [] });
  const [policyDialog, setPolicyDialog] = useState<{ kind: PolicyKind; policy: AnyPolicy | null } | null>(null);
  const [categoryQuery, setCategoryQuery] = useState('');
  const [categories, setCategories] = useState<PolicyOption[]>([]);
  const [searchingCategories, setSearchingCategories] = useState(false);
  const [refreshingPolicies, setRefreshingPolicies] = useState(false);

  const load = useCallback(async () => {
    try {
      const result = await getEbayStatus();
      setStatus(result);
      setEnvironment(result.environment);
      setAutoList(result.auto_list);
      setCategoryId(result.category_id || '');
      setCondition(result.condition || 'USED_EXCELLENT');
      setPostcode(result.postcode || '');
      setCity(result.city || '');
      setLocationName(result.location_name || '');
      setAddressLine1(result.address_line1 || '');
      setFulfillment(result.fulfillment_policy_id || '');
      setPayment(result.payment_policy_id || '');
      setReturns(result.return_policy_id || '');
      setError(null);
      if (result.connected) {
        getEbayHeldLocation().then((r) => setHeld(r.held)).catch(() => setHeld(null));
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
    if (result === 'cancelled') toast.info('eBay sign-in was cancelled — nothing was changed.');
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

  const handleSwitchMode = async (mode: 'sandbox' | 'production') => {
    if (mode === status?.environment) return;
    if (mode === 'production' && !window.confirm('Switch this dealership to LIVE eBay? New listings will go on the real eBay site. Existing test listings stay on the test site.')) return;
    try {
      const r = await switchEbayMode(mode);
      toast.success(`eBay switched to ${mode === 'production' ? 'live' : 'test'}${r.connected ? '' : ' — connect your account below'}`);
      setLoading(true);
      load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm(`Disconnect the ${status?.environment === 'production' ? 'live' : 'test'} eBay account? The other mode stays connected.`)) return;
    try {
      await disconnectEbay(status?.environment);
      toast.success('eBay disconnected from VeloDealer', {
        description: 'To fully remove access, also revoke VeloDealer on eBay (My eBay → Account → Third-party app permissions).',
        action: { label: 'Open eBay', onClick: () => window.open('https://accountsettings.ebay.co.uk/uas', '_blank', 'noopener') },
        duration: 12000,
      });
      load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const handleSave = async () => {
    if (!city.trim() || !postcode.trim()) {
      toast.error('Enter the town and postcode your bikes are sent from.');
      return;
    }
    setSaving(true);
    try {
      const res = await saveEbaySettings({
        auto_list: autoList,
        category_id: categoryId,
        condition,
        postcode,
        city,
        location_name: locationName,
        address_line1: addressLine1,
        country: 'GB',
        fulfillment_policy_id: fulfillment,
        payment_policy_id: payment,
        return_policy_id: returns,
      });
      if (res.location_error) toast.warning(`Settings saved, but eBay didn't take the new address: ${res.location_error}`);
      else toast.success('eBay settings saved');
      load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const policiesUrl = status?.environment === 'production'
    ? 'https://www.ebay.co.uk/bp/manage'
    : 'https://www.sandbox.ebay.co.uk/bp/manage';

  const handleRefreshPolicies = async () => {
    setRefreshingPolicies(true);
    try {
      setPolicies(await getEbayPolicies());
      toast.success('Policies refreshed');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRefreshingPolicies(false);
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

  const selectPolicy = (kind: PolicyKind, id: string) => {
    if (kind === 'fulfillment') setFulfillment(id);
    if (kind === 'payment') setPayment(id);
    if (kind === 'returns') setReturns(id);
  };

  const handlePolicySaved = (kind: PolicyKind, saved: AnyPolicy) => {
    setPolicies((prev) => {
      const list = prev[kind].filter((p) => p.id !== saved.id);
      return { ...prev, [kind]: [...list, saved].sort((a, b) => a.name.localeCompare(b.name)) };
    });
    selectPolicy(kind, saved.id);
    toast.success('Policy saved to eBay');
  };

  const handlePolicyDeleted = (kind: PolicyKind, policyId: string) => {
    setPolicies((prev) => ({ ...prev, [kind]: prev[kind].filter((p) => p.id !== policyId) }));
    if (kind === 'fulfillment' && fulfillment === policyId) setFulfillment('');
    if (kind === 'payment' && payment === policyId) setPayment('');
    if (kind === 'returns' && returns === policyId) setReturns('');
    toast.success('Policy deleted');
  };

  const renderPolicyPicker = (
    kind: PolicyKind,
    label: string,
    value: string,
    onChange: (v: string) => void,
  ) => {
    const list = policies[kind] as AnyPolicy[];
    const selected = list.find((p) => p.id === value) ?? null;
    return (
      <div className="space-y-1.5">
        <Label>{label}</Label>
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger><SelectValue placeholder="Choose a policy" /></SelectTrigger>
          <SelectContent className="max-h-[280px] overflow-y-auto">
            {list.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setPolicyDialog({ kind, policy: null })}>
            New
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={!selected}
            onClick={() => selected && setPolicyDialog({ kind, policy: selected })}
          >
            Edit
          </Button>
        </div>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Tag className="h-5 w-5 text-muted-foreground" />
            <CardTitle>eBay</CardTitle>
          </div>
          {!loading && status && (
            <div className="flex items-center gap-2">
              <Badge className={status.environment === 'production' ? 'bg-success text-success-foreground hover:bg-success' : 'bg-warning text-warning-foreground hover:bg-warning'}>
                eBay: {status.environment === 'production' ? 'Live' : 'Test'}
              </Badge>
              <Badge variant={status.connected ? 'default' : 'secondary'}>
                {status.connected ? 'Connected' : 'Not connected'}
              </Badge>
            </div>
          )}
        </div>
        <CardDescription>
          List bikes on your own eBay account automatically and end the listing when they sell elsewhere.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!loading && status?.can_manage && (
          <div className="rounded-lg border p-3 space-y-2">
            <div className="text-sm font-medium">eBay site</div>
            <div className="grid grid-cols-2 gap-2">
              {(['sandbox', 'production'] as const).map((m) => {
                const info = status.modes?.[m];
                const active = status.environment === m;
                return (
                  <Button
                    key={m}
                    type="button"
                    variant={active ? 'default' : 'outline'}
                    className="h-auto flex-col items-start py-2 text-left"
                    onClick={() => handleSwitchMode(m)}
                  >
                    <span>{m === 'production' ? 'Live eBay' : 'Test (sandbox)'}</span>
                    <span className="text-xs font-normal opacity-80">
                      {info?.connected ? `Connected${info.seller_name ? ` · ${info.seller_name}` : ''}` : 'Not connected'}
                    </span>
                  </Button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              Each site has its own eBay sign-in. Switching doesn't disconnect the other one.
            </p>
          </div>
        )}
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

            {status.needs_reconnect && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  eBay needs you to sign in again before listings can sync. Press Reconnect below.
                </AlertDescription>
              </Alert>
            )}
            {!status.needs_reconnect && status.refresh_token_expires_at &&
              Date.parse(status.refresh_token_expires_at) - Date.now() < 30 * 86_400_000 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Reconnect eBay before {new Date(status.refresh_token_expires_at).toLocaleDateString('en-GB')} to keep listings syncing.
                </AlertDescription>
              </Alert>
            )}


            <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
              <div>
                <div className="text-sm font-medium">List bikes automatically</div>
                <div className="text-xs text-muted-foreground">
                  Puts a bike on eBay as soon as it is ready for sale.
                </div>
              </div>
              <Switch checked={autoList} onCheckedChange={setAutoList} />
            </div>

            {policies.opt_in_required && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  This eBay account has not turned on business policies yet, so postage, payment and returns
                  policies can't be loaded or created. Open business policies on eBay, switch them on, then
                  refresh below.
                </AlertDescription>
              </Alert>
            )}

            <div className="flex flex-wrap items-center gap-2 rounded-lg border p-3">
              <p className="mr-auto text-xs text-muted-foreground">
                Create and edit your postage, payment and returns policies below — they save straight to eBay.
              </p>
              <Button variant="outline" size="sm" asChild>
                <a href={policiesUrl} target="_blank" rel="noreferrer">
                  Manage on eBay <ExternalLink className="ml-1 h-3 w-3" />
                </a>
              </Button>
              <Button variant="ghost" size="sm" onClick={handleRefreshPolicies} disabled={refreshingPolicies}>
                {refreshingPolicies
                  ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  : <RefreshCw className="mr-2 h-4 w-4" />}
                Refresh policies
              </Button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {renderPolicyPicker('fulfillment', 'Postage policy', fulfillment, setFulfillment)}
              {renderPolicyPicker('payment', 'Payment policy', payment, setPayment)}
              {renderPolicyPicker('returns', 'Returns policy', returns, setReturns)}
              <div className="space-y-1.5">
                <Label>Default item condition</Label>
                <Select value={condition} onValueChange={setCondition}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CONDITIONS.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-3 rounded border p-3 sm:col-span-2">
                <div>
                  <p className="text-sm font-medium">Despatch location</p>
                  <p className="text-xs text-muted-foreground">
                    Where your bikes are sent from. Buyers see this town on your listings.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="ebay-loc-name">Location name</Label>
                    <Input
                      id="ebay-loc-name"
                      value={locationName}
                      onChange={(e) => setLocationName(e.target.value)}
                      placeholder={status?.business_name || 'Your dealership'}
                      maxLength={80}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ebay-address">Address line</Label>
                    <Input id="ebay-address" value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} maxLength={120} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ebay-city">Town *</Label>
                    <Input id="ebay-city" value={city} onChange={(e) => setCity(e.target.value)} maxLength={80} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ebay-postcode">Postcode *</Label>
                    <Input id="ebay-postcode" value={postcode} onChange={(e) => setPostcode(e.target.value)} maxLength={12} />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {held === undefined
                    ? 'Checking what eBay holds…'
                    : held?.postcode
                      ? `eBay currently shows: ${[held.city, held.postcode].filter(Boolean).join(', ')}`
                      : 'eBay has no despatch location for you yet — save to set it.'}
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ebay-category">Default eBay category number</Label>
                <Input
                  id="ebay-category"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  placeholder="177831"
                />
                <p className="text-xs text-muted-foreground">
                  Each bike can use a different condition and category on its own page.
                </p>
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

            {status && <EbayListingSettings status={status} onReconnect={handleConnect} />}
          </>
        ) : (
          <>
            <Button onClick={handleConnect} disabled={connecting}>
              {connecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Link2 className="mr-2 h-4 w-4" />}
              Connect {environment === 'production' ? 'live' : 'test'} eBay
            </Button>
            <p className="text-xs text-muted-foreground">
              Disconnecting here removes the link from VeloDealer. eBay remembers that you allowed this app,
              so connecting again may not ask for your permission a second time. To remove that permission,
              visit{' '}
              <a
                className="underline"
                href={
                  environment === 'production'
                    ? 'https://accounts.ebay.co.uk/acctsec/security-center/third-party-app-access'
                    : 'https://accounts.sandbox.ebay.co.uk/acctsec/security-center/third-party-app-access'
                }
                target="_blank"
                rel="noreferrer"
              >
                third-party app access
              </a>{' '}
              in your eBay account.
            </p>
          </>
        )}
        {policyDialog && (
          <EbayPolicyDialog
            kind={policyDialog.kind}
            policy={policyDialog.policy}
            open
            onOpenChange={(o) => { if (!o) setPolicyDialog(null); }}
            onSaved={(saved) => handlePolicySaved(policyDialog.kind, saved)}
            onDeleted={(id) => handlePolicyDeleted(policyDialog.kind, id)}
          />
        )}
      </CardContent>
    </Card>
  );
}
