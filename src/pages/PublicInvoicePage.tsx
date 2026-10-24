import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { InvoiceDocument, type MirroredInvoice } from '@/components/invoice/InvoiceDocument';
import { downloadGeneratedInvoicePdf } from '@/lib/invoicePdf';
import { fetchInvoiceView } from '@/lib/invoiceView';

export default function PublicInvoicePage() {
  const { token = '' } = useParams();
  const [inv, setInv] = useState<MirroredInvoice | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Invoice';
    void 0;
    const meta = document.createElement('meta');
    meta.name = 'robots'; meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    if (!/^[a-f0-9]{64}$/.test(token)) { setError('Invoice not found'); return; }
    fetchInvoiceView({ token }).then(setInv).catch((e) => setError(e.message));
    return () => { meta.remove(); };
  }, [token]);

  const pdf = () => { if (inv) downloadGeneratedInvoicePdf(inv).catch(() => window.print()); };

  return (
    <main className="min-h-screen bg-background p-4">
      <div className="mx-auto max-w-3xl space-y-4">
        {error ? <p className="p-10 text-center text-muted-foreground">{error}</p>
          : !inv ? <div className="flex justify-center p-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
          : <>
              <div className="flex flex-wrap justify-end gap-2">
                <Button size="sm" variant="outline" onClick={pdf}>
                  <Download className="mr-1 h-4 w-4" />Download PDF
                </Button>
              </div>
              <InvoiceDocument inv={inv} />
            </>}
      </div>
    </main>
  );
}
