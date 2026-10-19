import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Download, ExternalLink, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { InvoiceDocument, type MirroredInvoice } from '@/components/invoice/InvoiceDocument';
import { fetchInvoiceView, downloadInvoicePdf } from '@/lib/invoiceView';

export default function PublicInvoicePage() {
  const { token = '' } = useParams();
  const [inv, setInv] = useState<MirroredInvoice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);

  useEffect(() => {
    document.title = 'Invoice';
    const meta = document.createElement('meta');
    meta.name = 'robots'; meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    if (!/^[a-f0-9]{64}$/.test(token)) { setError('Invoice not found'); return; }
    fetchInvoiceView({ token }).then(setInv).catch((e) => setError(e.message));
    return () => { meta.remove(); };
  }, [token]);

  const pdf = async () => {
    setPdfBusy(true);
    try { await downloadInvoicePdf({ token }, `Invoice-${inv?.doc_number ?? ''}.pdf`); }
    catch (e) { setError((e as Error).message); }
    finally { setPdfBusy(false); }
  };

  return (
    <main className="min-h-screen bg-background p-4">
      <div className="mx-auto max-w-3xl space-y-4">
        {error ? <p className="p-10 text-center text-muted-foreground">{error}</p>
          : !inv ? <div className="flex justify-center p-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
          : <>
              <div className="flex flex-wrap justify-end gap-2">
                {inv.pay_link && <Button size="sm" asChild><a href={inv.pay_link} target="_blank" rel="noreferrer"><ExternalLink className="mr-1 h-4 w-4" />Pay online</a></Button>}
                <Button size="sm" variant="outline" onClick={pdf} disabled={pdfBusy}>
                  {pdfBusy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Download className="mr-1 h-4 w-4" />}Download PDF
                </Button>
              </div>
              <InvoiceDocument inv={inv} />
            </>}
      </div>
    </main>
  );
}
