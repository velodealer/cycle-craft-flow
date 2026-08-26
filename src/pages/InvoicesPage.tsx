import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Loader2, RefreshCw, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { stockOutDocNumber, syncInvoice } from '@/lib/quickbooks';
import { toast } from 'sonner';

interface InvoiceRow {
  id: string;
  invoice_number: string;
  type: string;
  status: string;
  net: number;
  gross: number;
  vat_rate: number;
  issued_at: string | null;
  sync_status: string;
  sync_error: string | null;
  quickbooks_invoice_id: string | null;
  quickbooks_journal_id: string | null;

  bike_id: string | null;
  bikes: { id: string; make: string; model: string; reference: string | null } | null;
  external_owners: { name: string } | null;
}

const currency = (value: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(Number(value || 0));

function SyncBadge({ status }: { status: string }) {
  const variant = status === 'synced' ? 'default' : status === 'failed' ? 'destructive' : 'secondary';
  return <Badge variant={variant as any}>{status === 'not_synced' ? 'Not synced' : status}</Badge>;
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('invoices')
      .select('*, bikes:bike_id(id, make, model, reference), external_owners:external_customer_id(name)')
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
      [inv.invoice_number, inv.external_owners?.name, inv.bikes?.make, inv.bikes?.model, inv.bikes?.reference]
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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="rounded-lg bg-accent p-3">
          <FileText className="h-8 w-8 text-accent-foreground" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">Invoices</h1>
          <p className="mt-1 text-muted-foreground">Sales invoices, VAT treatment and QuickBooks sync status</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Invoices</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{totals.count}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total invoiced</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{currency(totals.gross)}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Awaiting sync</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{totals.unsynced}</CardContent></Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle>All invoices</CardTitle>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8" placeholder="Search invoices" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Button variant="outline" size="icon" onClick={load} aria-label="Refresh invoices">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 py-8 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading invoices…
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">No invoices yet. They are created when a bike is marked as sold.</p>
          ) : (
            <>
              {/* Mobile cards */}
              <div className="space-y-3 md:hidden">
                {filtered.map((inv) => (
                  <div key={inv.id} className="rounded-lg border p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">{inv.invoice_number}</p>
                        <p className="text-sm text-muted-foreground">{inv.external_owners?.name ?? '—'}</p>
                      </div>
                      <SyncBadge status={inv.sync_status} />
                    </div>
                    <p className="mt-2 text-sm">
                      {inv.bikes ? `${inv.bikes.make} ${inv.bikes.model}` : '—'} · {currency(inv.gross)} · VAT {inv.vat_rate}%
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      QB invoice {inv.quickbooks_invoice_id ? `#${inv.quickbooks_invoice_id}` : '—'} · Stock out {stockOutDocNumber(inv.bikes?.reference) ?? '—'}
                    </p>

                    <div className="mt-3 flex gap-2">
                      {inv.bike_id && (
                        <Button asChild variant="outline" size="sm"><Link to={`/bikes/${inv.bike_id}`}>View bike</Link></Button>
                      )}
                      <Button size="sm" onClick={() => handleSync(inv.id)} disabled={syncingId === inv.id}>
                        {syncingId === inv.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {inv.quickbooks_invoice_id ? 'Re-sync' : 'Sync'}
                      </Button>
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
                      <TableHead className="text-right">VAT</TableHead>
                      <TableHead className="text-right">Total</TableHead>
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
                        </TableCell>
                        <TableCell className="text-right">{currency(inv.net)}</TableCell>
                        <TableCell className="text-right">{inv.vat_rate}%</TableCell>
                        <TableCell className="text-right">{currency(inv.gross)}</TableCell>
                        <TableCell>
                          <SyncBadge status={inv.sync_status} />
                          <p className="mt-1 text-xs text-muted-foreground">
                            QB invoice {inv.quickbooks_invoice_id ? `#${inv.quickbooks_invoice_id}` : '—'}
                            {' · '}Stock out {stockOutDocNumber(inv.bikes?.reference) ?? '—'}
                          </p>
                          {inv.sync_error && <p className="mt-1 max-w-[240px] truncate text-xs text-destructive" title={inv.sync_error}>{inv.sync_error}</p>}

                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="outline" onClick={() => handleSync(inv.id)} disabled={syncingId === inv.id}>
                            {syncingId === inv.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {inv.quickbooks_invoice_id ? 'Re-sync' : 'Sync'}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
