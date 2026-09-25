import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Link2, Unlink, AlertCircle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useVatRegistered } from '@/hooks/useVatRegistered';
import {
  getXeroStatus, getXeroAuthUrl, listXeroTenants, chooseXeroTenant, listXeroAccounts, listXeroTaxRates,
  saveXeroAccounts, saveXeroTaxRates, disconnectXero, checkXeroHealth,
  type XeroStatus, type XeroAccount, type XeroAccountMap, type XeroTaxRate, type XeroTaxMap, type XeroTenant,
} from '@/lib/xero';

const ACCOUNT_FIELDS: { key: keyof XeroAccountMap; label: string; hint: string }[] = [
  { key: 'stock', label: 'Stock / Inventory (asset)', hint: 'Debited at intake with the purchase price, credited on sale.' },
  { key: 'purchase_funding', label: 'Purchase funding account', hint: 'Credited at intake — usually a bank or clearing account.' },
  { key: 'cogs', label: 'Cost of goods sold', hint: 'Debited on sale with the bike purchase price.' },
  { key: 'sales', label: 'Sales income', hint: 'Income account used on the customer invoice.' },
  { key: 'vat', label: 'Margin VAT liability', hint: 'Credited with margin scheme VAT (1/6 of the margin). Pick a liability account you can post journals to.' },
];
const LABELS: Record<string, string> = {
  stock: 'Stock', purchase_funding: 'Purchase funding', cogs: 'Cost of goods sold', sales: 'Sales', vat: 'Margin VAT',
  standard_sales: 'Standard sale VAT rate', margin_sales: 'Margin sale VAT rate',
};

export default function XeroIntegration() {
  const { vatRegistered } = useVatRegistered();
  const [status, setStatus] = useState<XeroStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tenants, setTenants] = useState<XeroTenant[]>([]);
  const [accounts, setAccounts] = useState<XeroAccount[]>([]);
  const [taxRates, setTaxRates] = useState<XeroTaxRate[]>([]);
  const [mapping, setMapping] = useState<XeroAccountMap>({});
  const [taxMap, setTaxMap] = useState<XeroTaxMap>({});

  const load = useCallback(async () => {
    try {
      const s = await getXeroStatus();
      setStatus(s);
      setMapping(s.accounts || {});
      setTaxMap(s.tax_types || {});
      setError(null);
      if (s.connected && s.can_manage) {
        if (!s.tenant_id) {
          listXeroTenants().then((r) => setTenants(r.tenants)).catch((e) => setError(e.message));
        } else {
          Promise.all([listXeroAccounts(), listXeroTaxRates()])
            .then(([a, t]) => { setAccounts(a.accounts); setTaxRates(t.tax_rates); })
            .catch((e) => setError(e.message));
        }
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
    const result = params.get('xero');
    if (!result) return;
    if (result === 'connected') toast.success('Xero connected');
    if (result === 'choose_org') toast.info('Xero connected — choose which organisation to use');
    if (result === 'error') toast.error(`Xero could not be connected: ${params.get('message') ?? ''}`);
    params.delete('xero');
    params.delete('message');
    const qs = params.toString();
    window.history.replaceState({}, '', `${window.location.pathname}${qs ? `?${qs}` : ''}`);
  }, []);

  const run = async (fn: () => Promise<unknown>, success?: string) => {
    setBusy(true);
    try {
      await fn();
      if (success) toast.success(success);
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const connect = async () => {
    setBusy(true);
    try {
      window.location.href = (await getXeroAuthUrl()).url;
    } catch (e) {
      toast.error((e as Error).message);
      setBusy(false);
    }
  };

  const connected = !!status?.connected;
  const missing = [...(status?.health?.missing_accounts ?? []), ...(status?.health?.missing_tax_types ?? [])];
  const taxOptions = [{ type: 'NONE', name: 'No VAT (NONE)', rate: 0 }, ...taxRates.filter((t) => t.type !== 'NONE')];

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>Xero</CardTitle>
          {!loading && (
            <Badge variant={connected ? 'default' : 'secondary'}>
              {connected ? (status?.tenant_name ? `Connected · ${status.tenant_name}` : 'Connected') : 'Not connected'}
            </Badge>
          )}
        </div>
        <CardDescription>
          Post bike purchases, sales invoices and margin scheme VAT to your Xero organisation. Works alongside QuickBooks.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
        ) : (
          <>
            {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
            {status?.auth_error && (
              <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{status.auth_error}</AlertDescription></Alert>
            )}
            {status && !status.configured && (
              <Alert><AlertCircle className="h-4 w-4" /><AlertDescription>Xero isn't set up on VeloDealer yet. Ask your VeloDealer administrator.</AlertDescription></Alert>
            )}

            {!status?.can_manage ? (
              <p className="text-sm text-muted-foreground">Only admins and owners can change the Xero connection.</p>
            ) : !connected ? (
              <Button onClick={connect} disabled={busy || !status?.configured}>
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Link2 className="mr-2 h-4 w-4" />}
                Connect Xero
              </Button>
            ) : !status.tenant_id ? (
              <div className="space-y-2">
                <Label>Which Xero organisation should VeloDealer use?</Label>
                <Select onValueChange={(v) => run(() => chooseXeroTenant(v), 'Organisation chosen')}>
                  <SelectTrigger><SelectValue placeholder={tenants.length ? 'Choose an organisation' : 'Loading…'} /></SelectTrigger>
                  <SelectContent>{tenants.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            ) : (
              <>
                {missing.length > 0 && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      These no longer exist or are archived in Xero: {missing.map((k) => LABELS[k] ?? k).join(', ')}. Choose new ones below.
                    </AlertDescription>
                  </Alert>
                )}

                <div className="space-y-3">
                  <div className="text-sm font-medium">Accounts</div>
                  {ACCOUNT_FIELDS.map((f) => (
                    <div key={f.key} className="space-y-1">
                      <Label>{f.label}</Label>
                      <Select value={mapping[f.key] ?? ''} onValueChange={(v) => setMapping((m) => ({ ...m, [f.key]: v }))}>
                        <SelectTrigger><SelectValue placeholder="Choose an account" /></SelectTrigger>
                        <SelectContent className="max-h-[280px] overflow-y-auto">
                          {accounts.map((a) => <SelectItem key={a.code} value={a.code}>{a.code} · {a.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">{f.hint}</p>
                    </div>
                  ))}
                  <Button onClick={() => run(() => saveXeroAccounts(mapping), 'Xero accounts saved')} disabled={busy}>
                    {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save accounts
                  </Button>
                </div>

                {vatRegistered ? (
                  <div className="space-y-3">
                    <div className="text-sm font-medium">VAT rates</div>
                    {(['standard_sales', 'margin_sales'] as const).map((k) => (
                      <div key={k} className="space-y-1">
                        <Label>{k === 'standard_sales' ? 'Standard VAT sale (and delivery)' : 'Margin scheme sale'}</Label>
                        <Select value={taxMap[k] ?? ''} onValueChange={(v) => setTaxMap((m) => ({ ...m, [k]: v }))}>
                          <SelectTrigger><SelectValue placeholder="Choose a VAT rate" /></SelectTrigger>
                          <SelectContent>
                            {taxOptions.map((t) => (
                              <SelectItem key={t.type} value={t.type}>{t.name}{t.rate != null ? ` (${t.rate}%)` : ''}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {k === 'margin_sales' && (
                          <p className="text-xs text-muted-foreground">
                            The margin VAT itself is posted by journal, so pick a rate with no VAT here (for example "No VAT").
                          </p>
                        )}
                      </div>
                    ))}
                    <Button onClick={() => run(() => saveXeroTaxRates(taxMap), 'Xero VAT rates saved')} disabled={busy}>
                      {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save VAT rates
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Your business is set as not VAT registered, so no VAT is sent to Xero.</p>
                )}

                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => run(() => checkXeroHealth(), 'Xero settings checked')} disabled={busy}>
                    <RefreshCw className="mr-2 h-4 w-4" /> Check settings
                  </Button>
                  <Button variant="outline" onClick={connect} disabled={busy}>
                    <Link2 className="mr-2 h-4 w-4" /> Reconnect / change organisation
                  </Button>
                </div>
              </>
            )}

            {connected && status?.can_manage && (
              <Button
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={() => { if (window.confirm('Disconnect Xero? Nothing already posted is changed.')) run(() => disconnectXero(), 'Xero disconnected'); }}
                disabled={busy}
              >
                <Unlink className="mr-2 h-4 w-4" /> Disconnect
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
