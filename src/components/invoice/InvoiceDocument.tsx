import { Badge } from '@/components/ui/badge';

export interface MirroredInvoice {
  doc_number: string | null;
  txn_date: string | null;
  due_date: string | null;
  currency: string;
  customer_name: string | null;
  bill_address: string[];
  customer_memo: string | null;
  lines: { description: string; qty: number | null; unit_price: number | null; amount: number }[];
  subtotal: number;
  tax: number;
  total: number;
  balance: number;
  amount_paid: number;
  status: 'paid' | 'partial' | 'unpaid' | 'overdue';
  payments: { date: string; amount: number }[];
  paid_at: string | null;
  seller: { name: string | null; address: string[]; email: string | null; phone: string | null } | null;
  pay_link: string | null;
  public_token?: string;
  app_url?: string;
}

const date = (d: string | null) => (d ? new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

const STATUS: Record<MirroredInvoice['status'], { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  paid: { label: 'Paid', variant: 'default' },
  partial: { label: 'Part paid', variant: 'secondary' },
  unpaid: { label: 'Unpaid', variant: 'outline' },
  overdue: { label: 'Overdue', variant: 'destructive' },
};

export function InvoiceDocument({ inv }: { inv: MirroredInvoice }) {
  const money = (n: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: inv.currency || 'GBP' }).format(n);
  const s = STATUS[inv.status];
  return (
    <article className="space-y-6 rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">{inv.seller?.name || 'Invoice'}</h2>
          {inv.seller?.address.map((l) => <p key={l} className="text-sm text-muted-foreground">{l}</p>)}
          {inv.seller?.email && <p className="text-sm text-muted-foreground">{inv.seller.email}</p>}
          {inv.seller?.phone && <p className="text-sm text-muted-foreground">{inv.seller.phone}</p>}
        </div>
        <div className="text-right">
          <p className="text-2xl font-semibold tracking-tight">INVOICE</p>
          <p className="text-sm">No. {inv.doc_number || '—'}</p>
          <Badge variant={s.variant} className="mt-2">{s.label}{inv.status === 'paid' && inv.paid_at ? ` · ${date(inv.paid_at)}` : ''}</Badge>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-xs uppercase text-muted-foreground">Bill to</p>
          <p className="font-medium">{inv.customer_name || '—'}</p>
          {inv.bill_address.map((l) => <p key={l} className="text-sm">{l}</p>)}
        </div>
        <dl className="grid grid-cols-2 gap-1 text-sm sm:text-right">
          <dt className="text-muted-foreground">Invoice date</dt><dd>{date(inv.txn_date)}</dd>
          <dt className="text-muted-foreground">Due date</dt><dd>{date(inv.due_date)}</dd>
        </dl>
      </section>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="py-2 font-medium">Description</th>
            <th className="py-2 text-right font-medium">Qty</th>
            <th className="py-2 text-right font-medium">Amount</th>
          </tr>
        </thead>
        <tbody>
          {inv.lines.map((l, i) => (
            <tr key={i} className="border-b last:border-0">
              <td className="py-2 pr-2">{l.description}</td>
              <td className="py-2 text-right">{l.qty ?? ''}</td>
              <td className="py-2 text-right">{money(l.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <dl className="ml-auto grid max-w-xs grid-cols-2 gap-1 text-sm">
        <dt className="text-muted-foreground">Subtotal</dt><dd className="text-right">{money(inv.subtotal)}</dd>
        {inv.tax > 0 && <><dt className="text-muted-foreground">VAT</dt><dd className="text-right">{money(inv.tax)}</dd></>}
        <dt className="font-medium">Total</dt><dd className="text-right font-medium">{money(inv.total)}</dd>
        {inv.amount_paid > 0 && <><dt className="text-muted-foreground">Paid</dt><dd className="text-right">−{money(inv.amount_paid)}</dd></>}
        <dt className="font-semibold">Balance due</dt><dd className="text-right font-semibold">{money(inv.balance)}</dd>
      </dl>

      {inv.payments.length > 0 && (
        <section>
          <p className="text-xs uppercase text-muted-foreground">Payments</p>
          {inv.payments.map((p, i) => <p key={i} className="text-sm">{date(p.date)} — {money(p.amount)}</p>)}
        </section>
      )}
      {inv.customer_memo && <p className="whitespace-pre-line text-sm text-muted-foreground">{inv.customer_memo}</p>}
    </article>
  );
}
