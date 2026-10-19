import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Copy, Download, ExternalLink, Loader2, Mail, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { emailInvoice } from '@/lib/invoiceEmail';
import { syncInvoice } from '@/lib/quickbooks';
import { fetchInvoiceView, downloadInvoicePdf, publicInvoiceUrl } from '@/lib/invoiceView';
import { InvoiceDocument, type MirroredInvoice } from '@/components/invoice/InvoiceDocument';
import { toast } from 'sonner';

export default function InvoiceDetailPage() {
  const { id } = useParams();
  const [inv, setInv] = useState<any>(null);
  const [doc, setDoc] = useState<MirroredInvoice | null>(null);
  const [docError, setDocError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [to, setTo] = useState('');
  const [busy, setBusy] = useState<'send' | 'sync' | 'pdf' | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setDocError(null);
    const { data } = await supabase
      .from('invoices')
      .select('id, invoice_number, quickbooks_invoice_id, external_owners:external_customer_id(name, email)')
      .eq('id', id!)
      .maybeSingle();
    setInv(data);
    setTo((data as any)?.external_owners?.email ?? '');
    if (data) {
      try { setDoc(await fetchInvoiceView({ invoice_id: id! })); }
      catch (e) { setDocError((e as Error).message); }
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const send = async () => {
    if (!to.includes('@')) return toast.error('Enter the customer email address');
    setBusy('send');
    const r = await emailInvoice(inv.id, to.trim());
    setBusy(null);
    if (r.ok) toast.success(`Invoice emailed to ${r.to}`);
    else toast.error(`Could not email the invoice: ${r.error}`);
  };

  const resync = async () => {
    setBusy('sync');
    try { await syncInvoice(inv.id); toast.success('Invoice synced to QuickBooks'); await load(); }
    catch (e) { toast.error(`QuickBooks sync failed: ${(e as Error).message}`); }
    finally { setBusy(null); }
  };

  const pdf = async () => {
    setBusy('pdf');
    try { await downloadInvoicePdf({ invoice_id: inv.id }, `Invoice-${doc?.doc_number || inv.invoice_number}.pdf`); }
    catch (e) { toast.error((e as Error).message); }
    finally { setBusy(null); }
  };

  const copyLink = async () => {
    if (!doc?.public_token) return;
    await navigator.clipboard.writeText(publicInvoiceUrl(doc.public_token));
    toast.success('Customer link copied');
  };

  if (loading && !inv) return <div className="flex justify-center p-10"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!inv) return <div className="p-6">Invoice not found. <Link to="/invoices" className="underline">Back to invoices</Link></div>;

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" asChild><Link to="/invoices"><ArrowLeft className="mr-1 h-4 w-4" />Invoices</Link></Button>
        <h1 className="text-lg font-semibold">Invoice {doc?.doc_number || inv.invoice_number}</h1>
        <Button size="sm" variant="ghost" className="ml-auto" onClick={load} disabled={loading}>
          <RefreshCw className={`mr-1 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh from QuickBooks
        </Button>
      </div>

      {doc && (
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={copyLink}><Copy className="mr-1 h-4 w-4" />Copy customer link</Button>
          {doc.public_token && <Button size="sm" variant="outline" asChild><a href={publicInvoiceUrl(doc.public_token)} target="_blank" rel="noreferrer"><ExternalLink className="mr-1 h-4 w-4" />Customer view</a></Button>}
          <Button size="sm" variant="outline" onClick={pdf} disabled={busy !== null}><Download className="mr-1 h-4 w-4" />PDF</Button>
          {doc.app_url && <Button size="sm" variant="ghost" asChild><a href={doc.app_url} target="_blank" rel="noreferrer">Open in QuickBooks</a></Button>}
          <div className="flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto">
            <Input className="h-9 flex-1 sm:w-56" type="email" placeholder="customer@email.com" value={to} onChange={(e) => setTo(e.target.value)} />
            <Button size="sm" onClick={send} disabled={busy !== null}>
              {busy === 'send' ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Mail className="mr-1 h-4 w-4" />}Email
            </Button>
          </div>
        </div>
      )}

      {loading && !doc ? (
        <div className="flex justify-center p-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : docError ? (
        <div className="space-y-3 rounded-md border p-4 text-sm">
          <p>{docError}</p>
          {!inv.quickbooks_invoice_id && (
            <Button size="sm" onClick={resync} disabled={busy !== null}>
              {busy === 'sync' ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1 h-4 w-4" />}Send to QuickBooks
            </Button>
          )}
        </div>
      ) : doc ? <InvoiceDocument inv={doc} /> : null}
    </div>
  );
}
