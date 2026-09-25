import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Loader2, RefreshCw, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { stockOutDocNumber, syncInvoice, reverseSale } from '@/lib/quickbooks';
import { trySyncXeroInvoice, getXeroStatus } from '@/lib/xero';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useVatRegistered } from '@/hooks/useVatRegistered';
import { PageHeader, Panel, EmptyState } from '@/components/velo/PageShell';
import { StatBlock } from '@/components/velo/StatBlock';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';


interface InvoiceRow {
  id: string;
  invoice_number: string;
  type: string;
  status: string;
  net: number;
  gross: number;
  sale_gross: number | null;
  part_exchange_value: number | null;
  part_exchange_bike_id: string | null;
  vat_rate: number;
  issued_at: string | null;
  sync_status: string;
  sync_error: string | null;
  quickbooks_invoice_id: string | null;
  quickbooks_journal_id: string | null;
  xero_invoice_id?: string | null;
  xero_sync_status?: string | null;
  xero_sync_error?: string | null;

  bike_id: string | null;
  bikes: { id: string; make: string; model: string; reference: string | null } | null;
  part_exchange_bikes: { id: string; make: string; model: string; reference: string | null } | null;
  external_owners: { name: string } | null;
  parts: { id: string; brand: string | null; description: string } | null;
}

const currency = (value: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(Number(value || 0));

function SyncBadge({ status }: { status: string }) {
  const variant = status === 'synced' ? 'default' : status === 'failed' ? 'destructive' : 'secondary';
  return <Badge variant={variant as any}>{status === 'not_synced' ? 'Not synced' : status}</Badge>;
}

export default function InvoicesPage() {
  const { vatRegistered } = useVatRegistered();
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<InvoiceRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [xeroConnected, setXeroConnected] = useState(false);

  useEffect(() => {
    getXeroStatus().then((s) => setXeroConnected(s.connected && !!s.tenant_id)).catch(() => setXeroConnected(false));
  }, []);


  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('invoices')
      .select('*, bikes:bike_id(id, make, model, reference), part_exchange_bikes:part_exchange_bike_id(id, make, model, reference), external_owners:external_customer_id(name), parts:part_id(id, brand, description)')
      .order('created_at', { ascending: false });
    if (error) toast.error(error.message);
    setInvoices((data as unknown as InvoiceRow[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return invoices;
    return invoices.filter((inv) =>
      [inv.invoice_number, inv.external_owners?.name, inv.bikes?.make, inv.bikes?.model, inv.bikes?.reference, inv.parts?.description, inv.parts?.brand]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term)),
    );
  }, [invoices, search]);

  const totals = useMemo(() => ({
    count: filtered.length,
    gross: filtered.reduce((sum, inv) => sum + Number(inv.gross || 0), 0),
    unsynced: filtered.filter((inv) => inv.sync_status !== 'synced').length,
  }), [filtered]);

  const handleSync = async (id: string) => {
    setSyncingId(id);
    try {
      await syncInvoice(id);
      toast.success('Invoice synced to QuickBooks');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSyncingId(null);
      load();
    }
  };

  const handleXeroSync = async (id: string) => {
    setSyncingId(`xero-${id}`);
    const r = await trySyncXeroInvoice(id);
    if (!r.ok) toast.error(r.error);
    else if (r.skipped) toast.info(r.skipped);
    else toast.success('Invoice synced to Xero');
    setSyncingId(null);
    load();
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      const result = await reverseSale({ invoiceId: toDelete.id, newStatus: 'ready' });
      toast.success(
        `Invoice deleted${result.part_exchange_bikes_deleted ? ` and ${result.part_exchange_bikes_deleted} part-exchange bike(s) removed` : ''}${
          result.bike_id ? '. The bike is back in stock as Ready for sale.' : '.'
        }`,
      );
      setToDelete(null);
      load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setDeleting(false);
    }
  };



  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoices"
        description="Invoices are issued in QuickBooks — VeloDealer tracks their sync state."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatBlock label="Invoices" value={totals.count} />
        <StatBlock label="Total invoiced" value={currency(totals.gross)} />
        <StatBlock label="Awaiting sync" value={totals.unsynced} hint={totals.unsynced ? 'Sync these to QuickBooks' : 'All posted'} />
      </div>

      <Panel
        title="All invoices"
        bodyClassName="p-0 sm:p-4"
        actions={
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8" placeholder="Search invoices" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Button variant="outline" size="icon" onClick={load} aria-label="Refresh invoices">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        }
      >
        <div className="p-4 sm:p-0">
          {loading ? (
            <div className="flex items-center gap-2 py-8 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading invoices…
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState fact="No invoices yet." fix="An invoice is created when a bike is marked as sold." />
          ) : (
            <>
              {/* Mobile cards */}
              <div className="space-y-3 md:hidden">
                {filtered.map((inv) => (
                  <div key={inv.id} className="rounded-[4px] border border-border p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">{inv.invoice_number}</p>
                        <p className="text-sm text-muted-foreground">{inv.external_owners?.name ?? '—'}</p>
                      </div>
                      <SyncBadge status={inv.sync_status} />
                    </div>
                    <p className="mt-2 text-sm">
                      {inv.bikes ? `${inv.bikes.make} ${inv.bikes.model}` : '—'} · {currency(inv.gross)}
                      {vatRegistered ? ` · VAT ${inv.vat_rate}%` : ''}
                    </p>
                    {Number(inv.part_exchange_value || 0) > 0 && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Sale {currency(inv.sale_gross ?? inv.gross)} · part exchange −{currency(inv.part_exchange_value ?? 0)}
                        {inv.part_exchange_bikes ? ` (${inv.part_exchange_bikes.make} ${inv.part_exchange_bikes.model})` : ''}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">
                      QB invoice {inv.quickbooks_invoice_id ? `#${inv.quickbooks_invoice_id}` : '—'} · Stock out {stockOutDocNumber(inv.bikes?.reference) ?? '—'}
                    </p>
                    {xeroConnected && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Xero invoice {inv.xero_invoice_id ? 'synced' : '—'}
                        {inv.xero_sync_error && <span className="text-destructive" title={inv.xero_sync_error}> · failed</span>}
                      </p>
                    )}

                    <div className="mt-3 flex gap-2">
                      {inv.bike_id && (
                        <Button asChild variant="outline" size="sm"><Link to={`/bikes/${inv.bike_id}`}>View bike</Link></Button>
                      )}
                      <Button size="sm" onClick={() => handleSync(inv.id)} disabled={syncingId === inv.id}>
                        {syncingId === inv.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {inv.quickbooks_invoice_id ? 'Re-sync' : 'Sync'}
                      </Button>
                      {xeroConnected && (
                        <Button size="sm" variant="outline" onClick={() => handleXeroSync(inv.id)} disabled={syncingId === `xero-${inv.id}`}>
                          {syncingId === `xero-${inv.id}` && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          {inv.xero_invoice_id ? 'Re-sync Xero' : 'Sync Xero'}
                        </Button>
                      )}
                      {isAdmin && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setToDelete(inv)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" /> Delete
                        </Button>
                      )}
                    </div>

                    {inv.sync_error && <p className="mt-2 text-xs text-destructive">{inv.sync_error}</p>}
                  </div>
                ))}
              </div>

              {/* Desktop table */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Bike</TableHead>
                      <TableHead className="text-right">Net</TableHead>
                      {vatRegistered && <TableHead className="text-right">VAT</TableHead>}
                      <TableHead className="text-right">Balance due</TableHead>
                      <TableHead>QuickBooks</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((inv) => (
                      <TableRow key={inv.id}>
                        <TableCell className="font-medium">{inv.invoice_number}</TableCell>
                        <TableCell>{inv.issued_at ? new Date(inv.issued_at).toLocaleDateString('en-GB') : '—'}</TableCell>
                        <TableCell>{inv.external_owners?.name ?? '—'}</TableCell>
                        <TableCell>
                          {inv.bikes ? (
                            <Link className="hover:underline" to={`/bikes/${inv.bikes.id}`}>
                              {inv.bikes.make} {inv.bikes.model}
                            </Link>
                          ) : '—'}
                          {Number(inv.part_exchange_value || 0) > 0 && (
                            <p className="text-xs text-muted-foreground">
                              Sale {currency(inv.sale_gross ?? inv.gross)} · PX −{currency(inv.part_exchange_value ?? 0)}
                              {inv.part_exchange_bikes && (
                                <>
                                  {' '}
                                  <Link className="hover:underline" to={`/bikes/${inv.part_exchange_bikes.id}`}>
                                    {inv.part_exchange_bikes.reference || `${inv.part_exchange_bikes.make} ${inv.part_exchange_bikes.model}`}
                                  </Link>
                                </>
                              )}
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="text-right">{currency(inv.net)}</TableCell>
                        {vatRegistered && <TableCell className="text-right">{inv.vat_rate}%</TableCell>}
                        <TableCell className="text-right">{currency(inv.gross)}</TableCell>
                        <TableCell>
                          <SyncBadge status={inv.sync_status} />
                          <p className="mt-1 text-xs text-muted-foreground">
                            QB invoice {inv.quickbooks_invoice_id ? `#${inv.quickbooks_invoice_id}` : '—'}
                            {' · '}Stock out {stockOutDocNumber(inv.bikes?.reference) ?? '—'}
                          </p>
                          {inv.sync_error && <p className="mt-1 max-w-[240px] truncate text-xs text-destructive" title={inv.sync_error}>{inv.sync_error}</p>}
                          {xeroConnected && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              Xero invoice {inv.xero_invoice_id ? 'synced' : '—'}
                              {inv.xero_sync_error && <span className="text-destructive" title={inv.xero_sync_error}> · failed</span>}
                            </p>
                          )}

                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="outline" onClick={() => handleSync(inv.id)} disabled={syncingId === inv.id}>
                              {syncingId === inv.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                              {inv.quickbooks_invoice_id ? 'Re-sync' : 'Sync'}
                            </Button>
                            {xeroConnected && (
                              <Button size="sm" variant="outline" onClick={() => handleXeroSync(inv.id)} disabled={syncingId === `xero-${inv.id}`}>
                                {syncingId === `xero-${inv.id}` && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {inv.xero_invoice_id ? 'Re-sync Xero' : 'Sync Xero'}
                              </Button>
                            )}
                            {isAdmin && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-destructive hover:text-destructive"
                                onClick={() => setToDelete(inv)}
                                aria-label={`Delete invoice ${inv.invoice_number}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>

                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </div>
      </Panel>

      <AlertDialog open={!!toDelete} onOpenChange={(open) => !open && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete invoice {toDelete?.invoice_number}?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>This reverses the whole sale:</p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>The QuickBooks invoice is voided and the stock-out journal deleted.</li>
                  <li>The bike goes back into stock as Ready for sale, with its sale price cleared.</li>
                  {Number(toDelete?.part_exchange_value || 0) > 0 && (
                    <li>The part-exchange bike taken in on this sale is deleted along with its stock posting.</li>
                  )}
                  <li>Any booked delivery for this sale is cancelled.</li>
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => { e.preventDefault(); handleDelete(); }}
              disabled={deleting}
            >
              {deleting ? 'Deleting…' : 'Delete invoice'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>

  );
}
