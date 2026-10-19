import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Download, ExternalLink, Loader2, Mail, RefreshCw } from 'lucide-react';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { emailInvoice } from '@/lib/invoiceEmail';
import { syncInvoice } from '@/lib/quickbooks';
import { toast } from 'sonner';

interface QboDoc { pdfUrl: string; appUrl: string; customerLink: string | null; docNumber: string | null }

export default function InvoiceDetailPage() {
  const { id } = useParams();
  const [inv, setInv] = useState<any>(null);
  const [doc, setDoc] = useState<QboDoc | null>(null);
  const [docError, setDocError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [to, setTo] = useState('');
  const [busy, setBusy] = useState<'send' | 'sync' | null>(null);

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
      const { data: r, error } = await supabase.functions.invoke('quickbooks-invoice-pdf', { body: { invoice_id: id } });
      if (error) {
        const t = error instanceof FunctionsHttpError ? await error.context.text() : error.message;
        let msg = t; try { msg = JSON.parse(t).error ?? t; } catch { /* raw */ }
        setDocError(msg);
      } else {
        const bytes = Uint8Array.from(atob((r as any).pdf_base64), (c) => c.charCodeAt(0));
        const pdfUrl = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
        setDoc((prev) => { if (prev) URL.revokeObjectURL(prev.pdfUrl); return { pdfUrl, appUrl: r.app_url, customerLink: r.customer_link, docNumber: r.doc_number }; });
      }
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const send = async () => {
    if (!to.includes('@')) return toast.error('Enter the customer email address');
    setBusy('send');
    const r = await emailInvoice(inv.id, to.trim());
    setBusy(null);
    if (r.ok) toast.success(`QuickBooks invoice emailed to ${r.to}`);
    else toast.error(`Could not email the invoice: ${r.error}`);
  };

  const resync = async () => {
    setBusy('sync');
    try { await syncInvoice(inv.id); toast.success('Invoice synced to QuickBooks'); await load(); }
    catch (e) { toast.error(`QuickBooks sync failed: ${(e as Error).message}`); }
    finally { setBusy(null); }
  };

  if (loading && !inv) return <div className="flex justify-center p-10"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!inv) return <div className="p-6">Invoice not found. <Link to="/invoices" className="underline">Back to invoices</Link></div>;

  const fileName = `Invoice-${(doc?.docNumber || inv.invoice_number).replace(/[^A-Za-z0-9-]/g, '')}.pdf`;

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" asChild><Link to="/invoices"><ArrowLeft className="mr-1 h-4 w-4" />Invoices</Link></Button>
        <h1 className="text-lg font-semibold">Invoice {doc?.docNumber || inv.invoice_number}</h1>
        {inv.external_owners?.name && <span className="text-sm text-muted-foreground">· {inv.external_owners.name}</span>}
      </div>

      {doc && (
        <div className="flex flex-wrap items-center gap-2">
          {doc.customerLink
            ? <Button size="sm" variant="outline" asChild><a href={doc.customerLink} target="_blank" rel="noreferrer"><ExternalLink className="mr-1 h-4 w-4" />View invoice online</a></Button>
            : <Button size="sm" variant="outline" asChild><a href={doc.appUrl} target="_blank" rel="noreferrer"><ExternalLink className="mr-1 h-4 w-4" />Open in QuickBooks</a></Button>}
          <Button size="sm" variant="outline" asChild><a href={doc.pdfUrl} download={fileName}><Download className="mr-1 h-4 w-4" />Download PDF</a></Button>
          {doc.customerLink && <Button size="sm" variant="outline" asChild><a href={doc.customerLink} target="_blank" rel="noreferrer"><ExternalLink className="mr-1 h-4 w-4" />Customer link</a></Button>}
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Input className="h-9 w-56" type="email" placeholder="customer@email.com" value={to} onChange={(e) => setTo(e.target.value)} />
            <Button size="sm" onClick={send} disabled={busy !== null}>
              {busy === 'send' ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Mail className="mr-1 h-4 w-4" />}Email to customer
            </Button>
          </div>
        </div>
      )}

      {loading ? (
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
      ) : doc ? (
        <iframe title="QuickBooks invoice" src={doc.pdfUrl} className="h-[80vh] w-full rounded-md border" />
      ) : null}
    </div>
  );
}
