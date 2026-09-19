import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, RefreshCw, Link2, Unlink, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import {
  getQuickBooksStatus,
  getQuickBooksAuthUrl,
  listQuickBooksAccounts,
  saveQuickBooksAccounts,
  listQuickBooksTaxCodes,
  saveQuickBooksTaxCodes,
  disconnectQuickBooks,
  checkQuickBooksCapabilities,
  listRecentQuickBooksErrors,

  type IntegrationErrorRow,
  type QboAccount,
  type QboAccountMap,
  type QboStatus,
  type QboTaxCode,
  type QboTaxCodeMap,
} from '@/lib/quickbooks';

const ACCOUNT_FIELDS: { key: keyof QboAccountMap; label: string; hint: string }[] = [
  { key: 'stock', label: 'Stock / Inventory (asset)', hint: 'Debited at intake with the purchase price, credited on sale.' },
  { key: 'purchase_funding', label: 'Purchase funding account', hint: 'Credited at intake — usually the bank or accounts payable account.' },
  { key: 'cogs', label: 'Cost of goods sold', hint: 'Debited on sale with the bike purchase price.' },
  { key: 'sales', label: 'Sales income', hint: 'Income account used on the customer invoice.' },
  { key: 'vat', label: 'VAT control / liability', hint: 'Credited with margin scheme VAT (1/6 of the margin).' },
  
];


export default function QuickBooksIntegration() {
  const { isSuperAdmin } = useAuth();
  const [status, setStatus] = useState<QboStatus | null>(null);
  const [accounts, setAccounts] = useState<QboAccount[]>([]);
  const [mapping, setMapping] = useState<QboAccountMap>({});
  const [taxCodes, setTaxCodes] = useState<QboTaxCode[]>([]);
  const [taxMapping, setTaxMapping] = useState<QboTaxCodeMap>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkingFeatures, setCheckingFeatures] = useState(false);
  const [qboErrors, setQboErrors] = useState<IntegrationErrorRow[]>([]);

  const ACCOUNT_LABELS: Record<string, string> = {
    stock: 'Stock / inventory',
    cogs: 'Cost of goods sold',
    sales: 'Sales income',
    vat: 'VAT control',
    purchase_funding: 'Purchase funding',
  };

  const handleCheckFeatures = async () => {
    setCheckingFeatures(true);
    try {
      await checkQuickBooksCapabilities(true);
      await loadStatus();
      toast.success('QuickBooks features re-checked');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setCheckingFeatures(false);
    }
  };



  const loadStatus = useCallback(async () => {
    try {
      const result = await getQuickBooksStatus();
      setStatus(result);
      setMapping(result.accounts || {});
      setTaxMapping(result.tax_codes || {});
      setError(null);
      return result;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAccounts = useCallback(async () => {
    setLoadingAccounts(true);
    try {
      const { accounts: list } = await listQuickBooksAccounts();
      setAccounts(list);
    } catch (e) {
      toast.error(`Could not load QuickBooks accounts: ${(e as Error).message}`);
    } finally {
      setLoadingAccounts(false);
    }
  }, []);

  const loadTaxCodes = useCallback(async () => {
    try {
      const { tax_codes: list } = await listQuickBooksTaxCodes();
      setTaxCodes(list);
    } catch (e) {
      toast.error(`Could not load QuickBooks VAT codes: ${(e as Error).message}`);
    }
  }, []);

  const loadErrors = useCallback(async () => {
    try {
      setQboErrors(await listRecentQuickBooksErrors());
    } catch {
      // Panel is informational only — never block the settings page on it.
    }
  }, []);

  useEffect(() => {
    loadStatus().then((s) => {
      if (s?.connected) {
        loadAccounts();
        loadTaxCodes();
      }
    });
    if (isSuperAdmin) loadErrors();
  }, [isSuperAdmin, loadStatus, loadAccounts, loadTaxCodes, loadErrors]);

  const copyErrorLog = async () => {
    const text = qboErrors
      .map((row) =>
        [
          `${new Date(row.created_at).toISOString()} [${row.operation}] status=${row.status ?? 'n/a'} intuit_tid=${row.intuit_tid ?? 'n/a'}${row.entity_ref ? ` ref=${row.entity_ref}` : ''}`,
          row.message,
        ].join('\n'),
      )
      .join('\n\n');
    await navigator.clipboard.writeText(text || 'No QuickBooks errors recorded.');
    toast.success('Error log copied — paste it into your message to Intuit support');
  };

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'quickbooks-connected') {
        toast.success('QuickBooks connected');
        loadStatus().then((s) => { if (s?.connected) { loadAccounts(); loadTaxCodes(); } });
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [loadStatus, loadAccounts, loadTaxCodes]);

  const handleConnect = async () => {
    try {
      const { url } = await getQuickBooksAuthUrl();
      window.open(url, 'quickbooks-oauth', 'width=620,height=760');
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnectQuickBooks();
      setAccounts([]);
      toast.success('QuickBooks disconnected');
      loadStatus();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveQuickBooksAccounts(mapping);
      await saveQuickBooksTaxCodes(taxMapping);
      toast.success('QuickBooks mapping saved');
      loadStatus();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 py-8 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading QuickBooks status…
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              QuickBooks Online
              {status?.connected ? (
                <Badge variant="default">Connected</Badge>
              ) : status?.auth_error ? (
                <Badge variant="destructive">Reconnect needed</Badge>
              ) : (
                <Badge variant="secondary">Not connected</Badge>
              )}
              {isSuperAdmin && status?.environment && <Badge variant="outline">{status.environment}</Badge>}
            </CardTitle>
            <CardDescription>
              Post bike purchases to stock at intake and sales invoices, COGS and margin VAT when a bike is sold.
            </CardDescription>
          </div>
          <div className="flex gap-2">
            {status?.connected ? (
              <>
                <Button variant="outline" size="sm" onClick={loadAccounts} disabled={loadingAccounts}>
                  {loadingAccounts ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                  Refresh accounts
                </Button>
                <Button variant="outline" size="sm" onClick={handleDisconnect}>
                  <Unlink className="mr-2 h-4 w-4" /> Disconnect
                </Button>
              </>
            ) : (
              <Button size="sm" onClick={handleConnect}>
                <Link2 className="mr-2 h-4 w-4" /> Connect QuickBooks
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {!status?.connected && status?.auth_error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Your QuickBooks connection expired or was revoked. Please reconnect using the
              Connect QuickBooks button above — your account mapping is saved and will carry over.
            </AlertDescription>
          </Alert>
        )}

        {status?.connected && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {ACCOUNT_FIELDS.map((field) => (
                <div key={field.key} className="space-y-1.5">
                  <Label>{field.label}</Label>
                  <Select
                    value={mapping[field.key] ?? ''}
                    onValueChange={(value) => setMapping((prev) => ({ ...prev, [field.key]: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={accounts.length ? 'Select an account' : 'Refresh accounts first'} />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.name} · {account.type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">{field.hint}</p>
                </div>
              ))}
            </div>
            <div className="border-t pt-4">
              <h4 className="mb-3 font-medium">Sales VAT codes</h4>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {([
                  ['standard_sales', 'Standard VAT sales', 'Choose the active 20% sales VAT code from this QuickBooks company.'],
                  ['margin_sales', 'No VAT / margin scheme', 'Choose the no-VAT sales code; margin VAT is posted separately.'],
                ] as const).map(([key, label, hint]) => (
                  <div key={key} className="space-y-1.5">
                    <Label>{label}</Label>
                    <Select
                      value={taxMapping[key] ?? ''}
                      onValueChange={(value) => setTaxMapping((prev) => ({ ...prev, [key]: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a QuickBooks VAT code" />
                      </SelectTrigger>
                      <SelectContent>
                        {taxCodes.map((code) => (
                          <SelectItem key={code.id} value={code.id}>
                            {code.name}{code.rate === null ? '' : ` · ${code.rate}%`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">{hint}</p>
                  </div>
                ))}
              </div>
            </div>

            {isSuperAdmin && <div className="border-t pt-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div>
                  <h4 className="font-medium">QuickBooks features in this company</h4>
                  <p className="text-xs text-muted-foreground">
                    Checked automatically when you connect and once a day, so the app follows what this
                    QuickBooks plan can do today.
                    {status.capabilities_checked_at
                      ? ` Last checked ${new Date(status.capabilities_checked_at).toLocaleString()}.`
                      : ''}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={handleCheckFeatures} disabled={checkingFeatures}>
                  {checkingFeatures ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  Re-check features
                </Button>
              </div>

              {status.capabilities ? (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={status.capabilities.journal_entries ? 'secondary' : 'destructive'}>
                      Journal entries {status.capabilities.journal_entries ? 'available' : 'unavailable'}
                    </Badge>
                    <Badge variant={status.capabilities.sales_tax ? 'secondary' : 'outline'}>
                      VAT {status.capabilities.sales_tax ? 'enabled' : 'off'}
                    </Badge>
                    <Badge variant="outline">
                      {status.capabilities.tax_codes.length} VAT code
                      {status.capabilities.tax_codes.length === 1 ? '' : 's'}
                    </Badge>
                    {status.capabilities.multicurrency && <Badge variant="outline">Multi-currency</Badge>}
                    {status.capabilities.home_currency && (
                      <Badge variant="outline">{status.capabilities.home_currency}</Badge>
                    )}
                  </div>

                  {status.capabilities.accounts_missing.length > 0 && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        These accounts are no longer in QuickBooks:{' '}
                        {status.capabilities.accounts_missing
                          .map((key) => ACCOUNT_LABELS[key] ?? key)
                          .join(', ')}
                        . Postings that need them are on hold until you pick replacements above and save.
                      </AlertDescription>
                    </Alert>
                  )}

                  {!status.capabilities.journal_entries && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        This QuickBooks company cannot accept journal entries at the moment, so stock and VAT
                        postings are held until the plan allows them again.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {status.capabilities_error ?? 'No feature check has run yet.'}
                </p>
              )}
            </div>}

            {isSuperAdmin && <div className="border-t pt-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div>
                  <h4 className="font-medium">Recent QuickBooks errors</h4>
                  <p className="text-xs text-muted-foreground">
                    Every failed QuickBooks call is logged with its Intuit transaction ID (intuit_tid) so
                    Intuit support can trace it. Copy the log when raising a support case.
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={copyErrorLog} disabled={qboErrors.length === 0}>
                  Copy log
                </Button>
              </div>
              {qboErrors.length === 0 ? (
                <p className="text-sm text-muted-foreground">No QuickBooks errors recorded.</p>
              ) : (
                <div className="max-h-64 space-y-2 overflow-y-auto rounded-md border p-3">
                  {qboErrors.map((row) => (
                    <div key={row.id} className="text-xs">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-muted-foreground">
                          {new Date(row.created_at).toLocaleString()}
                        </span>
                        <Badge variant="outline">{row.operation}</Badge>
                        {row.status && <Badge variant="destructive">{row.status}</Badge>}
                        {row.intuit_tid && (
                          <span className="font-mono text-muted-foreground">tid: {row.intuit_tid}</span>
                        )}
                      </div>
                      <p className="mt-1 break-words">{row.message}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>}

            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save account mapping
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
