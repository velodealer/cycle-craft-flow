import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Mail, Printer } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { emailInvoice } from '@/lib/invoiceEmail';
import { toast } from 'sonner';

const gbp = (n: unknown) => `£${(Number(n) || 0).toFixed(2)}`;

export default function InvoiceDetailPage() {
  const { id } = useParams();
  const [inv, setInv] = useState<any>(null);
  const [biz, setBiz] = useState<{ name: string; contact_email: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [to, setTo] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('*, bikes:bike_id(id, reference, make, model, year, size, colour, frame_number, serial_number, finance_scheme), external_owners:external_customer_id(name, email, phone, address), parts:part_id(brand, description)')
        .eq('id', id!)
        .maybeSingle();
      if (error) toast.error(error.message);
      setInv(data);
      setTo((data as any)?.external_owners?.email ?? '');
      if (data) {
        const { data: b } = await supabase.from('businesses').select('name, contact_email').eq('id', (data as any).business_id).maybeSingle();
        setBiz(b);
      }
      setLoading(false);
    })();
  }, [id]);

  const send = async () => {
    if (!to.includes('@')) return toast.error('Enter the customer email address');
    setSending(true);
    const r = await emailInvoice(inv.id, to.trim());
    setSending(false);
    if (r.ok) toast.success(`Invoice emailed to ${r.to}`);
    else toast.error(`Could not email the invoice: ${r.error}`);
  };

  if (loading) return <div className="flex justify-center p-10"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!inv) return <div className="p-6">Invoice not found. <Link to="/invoices" className="underline">Back to invoices</Link></div>;

  const b = inv.bikes;
  const margin = inv.finance_scheme === 'margin_scheme' || b?.finance_scheme === 'margin_scheme';
  const showVat = Number(inv.vat_rate) > 0 && !margin;
  const item = b
    ? `${[b.year, b.make, b.model].filter(Boolean).join(' ')}${b.reference ? ` (${b.reference})` : ''}`
    : inv.parts ? [inv.parts.brand, inv.parts.description].filter(Boolean).join(' — ') : 'Sale';
  const detail = b ? [b.size && `Size ${b.size}`, b.colour, (b.frame_number || b.serial_number) && `Frame no. ${b.frame_number || b.serial_number}`].filter(Boolean).join(' · ') : '';
  const hasPx = Number(inv.part_exchange_value) > 0;

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <Button variant="ghost" size="sm" asChild><Link to="/invoices"><ArrowLeft className="mr-1 h-4 w-4" />Invoices</Link></Button>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Input className="h-9 w-56" type="email" placeholder="customer@email.com" value={to} onChange={(e) => setTo(e.target.value)} />
          <Button size="sm" onClick={send} disabled={sending}>
            {sending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Mail className="mr-1 h-4 w-4" />}Email to customer
          </Button>
          <Button size="sm" variant="outline" onClick={() => window.print()}><Printer className="mr-1 h-4 w-4" />Print / PDF</Button>
        </div>
      </div>

      <div className="rounded-md border bg-card p-6 text-card-foreground">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">{biz?.name}</h1>
            {biz?.contact_email && <p className="text-sm text-muted-foreground">{biz.contact_email}</p>}
          </div>
          <div className="text-right">
            <p className="text-lg font-semibold">Invoice {inv.invoice_number}</p>
            <p className="text-sm text-muted-foreground">{inv.issued_at ? new Date(inv.issued_at).toLocaleDateString('en-GB') : ''}</p>
            <Badge variant="outline" className="mt-1 capitalize">{inv.status}</Badge>
          </div>
        </div>

        <div className="mt-6 text-sm">
          <p className="text-muted-foreground">Bill to</p>
          <p className="font-medium">{inv.external_owners?.name || inv.customer_name || '—'}</p>
          {inv.external_owners?.address && <p className="whitespace-pre-line text-muted-foreground">{inv.external_owners.address}</p>}
          {inv.external_owners?.email && <p className="text-muted-foreground">{inv.external_owners.email}</p>}
        </div>

        <div className="mt-6 divide-y border-t text-sm">
          <div className="flex justify-between gap-4 py-2">
            <div>{b ? <Link to={`/bikes/${b.id}`} className="font-medium hover:underline print:no-underline">{item}</Link> : <span className="font-medium">{item}</span>}
              {detail && <p className="text-xs text-muted-foreground">{detail}</p>}</div>
            <span>{gbp(inv.sale_gross ?? inv.gross)}</span>
          </div>
          {inv.delivery_charged_to_customer && Number(inv.delivery_charge) > 0 && (
            <div className="flex justify-between py-2"><span>Delivery</span><span>{gbp(inv.delivery_charge)}</span></div>
          )}
          {hasPx && <div className="flex justify-between py-2"><span>Part exchange</span><span>−{gbp(inv.part_exchange_value)}</span></div>}
          {showVat && (
            <>
              <div className="flex justify-between py-2 text-muted-foreground"><span>Net</span><span>{gbp(inv.net)}</span></div>
              <div className="flex justify-between py-2 text-muted-foreground"><span>VAT ({inv.vat_rate}%)</span><span>{gbp(Number(inv.gross) - Number(inv.net))}</span></div>
            </>
          )}
          <div className="flex justify-between border-t-2 border-foreground py-3 font-semibold">
            <span>{hasPx ? 'Balance due' : 'Total'}</span><span>{gbp(inv.gross)}</span>
          </div>
        </div>
        {margin && <p className="mt-4 text-xs text-muted-foreground">Second-hand margin scheme: input tax has not been and will not be claimed. No VAT is shown on this invoice.</p>}
      </div>
    </div>
  );
}
