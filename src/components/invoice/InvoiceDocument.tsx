import { CheckCircle2, Clock, AlertTriangle, Landmark } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  branding?: {
    business_name: string | null;
    logo_url: string | null;
    footer_note: string | null;
    bank: { account_name: string | null; account_number: string; sort_code: string | null } | null;
  };
  pay_link: string | null;
  public_token?: string;
  app_url?: string;
}

const date = (d: string | null) => (d ? new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

const STATUS = {
  paid: { label: 'Paid', icon: CheckCircle2, cls: 'bg-primary text-primary-foreground' },
  partial: { label: 'Part paid', icon: Clock, cls: 'bg-secondary text-secondary-foreground' },
  unpaid: { label: 'Awaiting payment', icon: Clock, cls: 'bg-muted text-foreground' },
  overdue: { label: 'Overdue', icon: AlertTriangle, cls: 'bg-destructive text-destructive-foreground' },
} as const;

export function InvoiceDocument({ inv }: { inv: MirroredInvoice }) {
  const money = (n: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: inv.currency || 'GBP' }).format(n);
  const s = STATUS[inv.status];
  const name = inv.seller?.name || inv.branding?.business_name || 'Invoice';
  const bank = inv.branding?.bank;

  return (
    <article id="invoice-document" className="overflow-hidden rounded-xl border bg-card text-card-foreground shadow-lg print:rounded-none print:border-0 print:shadow-none">
      <div className="h-2 bg-primary" />
      <div className="space-y-8 p-6 sm:p-10">
        <header className="flex flex-wrap items-start justify-between gap-6">
          <div className="space-y-2">
            {inv.branding?.logo_url
              ? <img src={inv.branding.logo_url} alt={name} className="max-h-16 max-w-[220px] object-contain" />
              : <h2 className="text-2xl font-bold tracking-tight">{name}</h2>}
            <div className="text-sm text-muted-foreground">
              {inv.branding?.logo_url && <p className="font-medium text-foreground">{name}</p>}
              {inv.seller?.address.map((l) => <p key={l}>{l}</p>)}
              {inv.seller?.email && <p>{inv.seller.email}</p>}
              {inv.seller?.phone && <p>{inv.seller.phone}</p>}
            </div>
          </div>
          <div className="space-y-2 text-right">
            <p className="text-3xl font-light uppercase tracking-[0.2em] text-primary">Invoice</p>
            <p className="text-sm text-muted-foreground">No. <span className="font-medium text-foreground">{inv.doc_number || '—'}</span></p>
            <span className={cn('inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold', s.cls)}>
              <s.icon className="h-3.5 w-3.5" />{s.label}{inv.status === 'paid' && inv.paid_at ? ` · ${date(inv.paid_at)}` : ''}
            </span>
          </div>
        </header>

        <section className="grid gap-4 rounded-lg bg-muted/40 p-4 sm:grid-cols-3">
          <div className="sm:col-span-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Billed to</p>
            <p className="mt-1 font-medium">{inv.customer_name || '—'}</p>
            {inv.bill_address.map((l) => <p key={l} className="text-sm">{l}</p>)}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Invoice date</p>
            <p className="mt-1">{date(inv.txn_date)}</p>
            <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Due date</p>
            <p className="mt-1">{date(inv.due_date)}</p>
          </div>
          <div className="sm:text-right">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Balance due</p>
            <p className={cn('mt-1 text-3xl font-bold', inv.balance <= 0 ? 'text-primary' : '')}>{money(inv.balance)}</p>
          </div>
        </section>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-primary text-left text-xs uppercase tracking-wider text-muted-foreground">
              <th className="pb-2 font-semibold">Description</th>
              <th className="pb-2 text-right font-semibold">Qty</th>
              <th className="pb-2 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {inv.lines.map((l, i) => (
              <tr key={i} className="border-b last:border-0">
                <td className="py-3 pr-2">{l.description}</td>
                <td className="py-3 text-right">{l.qty ?? ''}</td>
                <td className="py-3 text-right font-medium">{money(l.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex flex-wrap items-start justify-between gap-6">
          {bank ? (
            <section className="min-w-[240px] flex-1 rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm">
              <p className="mb-2 flex items-center gap-2 font-semibold"><Landmark className="h-4 w-4 text-primary" />Please forward payment to</p>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
                {bank.account_name && <><dt className="text-muted-foreground">Account holder</dt><dd className="font-medium">{bank.account_name}</dd></>}
                <dt className="text-muted-foreground">Account number</dt><dd className="font-mono font-medium">{bank.account_number}</dd>
                {bank.sort_code && <><dt className="text-muted-foreground">Sort code</dt><dd className="font-mono font-medium">{bank.sort_code}</dd></>}
                {inv.doc_number && <><dt className="text-muted-foreground">Reference</dt><dd className="font-mono font-medium">{inv.doc_number}</dd></>}
              </dl>
            </section>
          ) : <div />}
          <dl className="ml-auto grid w-full max-w-xs grid-cols-2 gap-y-1.5 text-sm">
            <dt className="text-muted-foreground">Subtotal</dt><dd className="text-right">{money(inv.subtotal)}</dd>
            {inv.tax > 0 && <><dt className="text-muted-foreground">VAT</dt><dd className="text-right">{money(inv.tax)}</dd></>}
            <dt className="border-t pt-1.5 font-semibold">Total</dt><dd className="border-t pt-1.5 text-right font-semibold">{money(inv.total)}</dd>
            {inv.amount_paid > 0 && <><dt className="text-muted-foreground">Paid</dt><dd className="text-right">−{money(inv.amount_paid)}</dd></>}
            <dt className="rounded-l-md bg-primary px-2 py-1.5 font-bold text-primary-foreground">Balance due</dt>
            <dd className="rounded-r-md bg-primary px-2 py-1.5 text-right font-bold text-primary-foreground">{money(inv.balance)}</dd>
          </dl>
        </div>

        {inv.payments.length > 0 && (
          <section className="text-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Payments received</p>
            {inv.payments.map((p, i) => <p key={i} className="mt-1 flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" />{date(p.date)} — {money(p.amount)}</p>)}
          </section>
        )}

        {(inv.customer_memo || inv.branding?.footer_note) && (
          <footer className="space-y-1 border-t pt-4 text-sm text-muted-foreground">
            {inv.customer_memo && <p className="whitespace-pre-line">{inv.customer_memo}</p>}
            {inv.branding?.footer_note && <p className="whitespace-pre-line">{inv.branding.footer_note}</p>}
          </footer>
        )}
        <p className="text-center text-xs text-muted-foreground">Thank you for your business.</p>
      </div>
    </article>
  );
}
