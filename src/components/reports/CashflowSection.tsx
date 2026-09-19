import { useMemo } from 'react';
import { format } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import ReportTable from './ReportTable';
import { avg, daysBetween, inRange, money, num, pct, sum, titleCase, type Range } from '@/lib/reports';
import { soldIn, type BikeRow } from '@/lib/reportMetrics';
import type { ReportsData } from '@/hooks/useReportsData';
import { useVatRegistered } from '@/hooks/useVatRegistered';

interface Props { rows: BikeRow[]; data: ReportsData; range: Range }

export default function CashflowSection({ rows, data, range }: Props) {
  const { vatRegistered } = useVatRegistered();
  const ids = useMemo(() => new Set(rows.map((r) => r.id)), [rows]);
  const invoices = useMemo(
    () => data.invoices.filter((i) => (!i.bike_id || ids.has(i.bike_id)) && inRange(i.issued_at || i.created_at, range)),
    [data.invoices, ids, range],
  );

  const stats = useMemo(() => {
    const paid = invoices.filter((i) => i.status === 'paid');
    const outstanding = invoices.filter((i) => ['issued', 'overdue'].includes(i.status));
    const paymentDays = paid
      .filter((i) => i.paid_at && i.issued_at)
      .map((i) => daysBetween(i.issued_at, new Date(i.paid_at)));
    return {
      invoiced: sum(invoices, (i) => Number(i.gross || i.total || 0)),
      paid: sum(paid, (i) => Number(i.gross || i.total || 0)),
      outstanding: sum(outstanding, (i) => Number(i.gross || i.total || 0)),
      overdue: sum(invoices.filter((i) => i.status === 'overdue'), (i) => Number(i.gross || i.total || 0)),
      avgDaysToPay: paymentDays.length ? paymentDays.reduce((a, b) => a + b, 0) / paymentDays.length : 0,
      partExchange: sum(invoices, (i) => Number(i.part_exchange_value || 0)),
      deliveryCharged: sum(invoices, (i) => Number(i.delivery_charge || 0)),
      deliveryPaid: sum(soldIn(rows, range), (r) => r.logisticsCost),
      vatAvg: avg(invoices.filter((i) => i.vat_rate != null), (i) => Number(i.vat_rate)),
    };
  }, [invoices, rows, range]);

  const ageing = useMemo(() => {
    const open = invoices.filter((i) => ['issued', 'overdue'].includes(i.status));
    const bands = [
      { label: 'Not yet due', test: (d: number) => d <= 0 },
      { label: '1–30 days', test: (d: number) => d > 0 && d <= 30 },
      { label: '31–60 days', test: (d: number) => d > 30 && d <= 60 },
      { label: '60+ days', test: (d: number) => d > 60 },
    ];
    return bands.map((b) => {
      const list = open.filter((i) => b.test(daysBetween(i.due_date || i.issued_at)));
      return { label: b.label, count: list.length, value: sum(list, (i) => Number(i.gross || i.total || 0)) };
    });
  }, [invoices]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Cash position</CardTitle>
          <CardDescription>Invoices raised in the selected period.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
            <Stat label="Invoiced" value={money(stats.invoiced)} />
            <Stat label="Collected" value={money(stats.paid)} sub={pct(stats.invoiced ? stats.paid / stats.invoiced : 0)} />
            <Stat label="Outstanding" value={money(stats.outstanding)} sub={`${money(stats.overdue)} overdue`} />
            <Stat label="Avg days to pay" value={stats.avgDaysToPay ? num(stats.avgDaysToPay, 0) : '—'} />
            <Stat label="Part exchange taken" value={money(stats.partExchange)} />
            <Stat label="Delivery charged" value={money(stats.deliveryCharged)} sub={`${money(stats.deliveryPaid)} cost`} />
            <Stat label="Delivery recovery" value={stats.deliveryPaid ? pct(stats.deliveryCharged / stats.deliveryPaid) : '—'} />
            {vatRegistered && <Stat label="Avg VAT rate" value={stats.vatAvg ? `${num(stats.vatAvg, 1)}%` : '—'} />}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Debtor ageing</CardTitle></CardHeader>
        <CardContent>
          <ReportTable
            rows={ageing}
            rowKey={(r) => r.label}
            csvName="debtor-ageing"
            initialSort="value"
            columns={[
              { key: 'label', label: 'Age', value: (r) => r.label },
              { key: 'count', label: 'Invoices', right: true, value: (r) => r.count },
              { key: 'value', label: 'Value', right: true, value: (r) => money(r.value), sortValue: (r) => r.value },
            ]}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Invoices</CardTitle></CardHeader>
        <CardContent>
          <ReportTable
            rows={invoices}
            rowKey={(r: any) => r.id}
            csvName="invoices"
            initialSort="issued_at"
            columns={[
              { key: 'invoice_number', label: 'Number', value: (r: any) => r.invoice_number || '—' },
              { key: 'type', label: 'Type', value: (r: any) => titleCase(r.type) },
              { key: 'status', label: 'Status', value: (r: any) => titleCase(r.status) },
              { key: 'issued_at', label: 'Issued', value: (r: any) => (r.issued_at ? format(new Date(r.issued_at), 'd MMM yy') : '—'), sortValue: (r: any) => r.issued_at || '' },
              { key: 'paid_at', label: 'Paid', value: (r: any) => (r.paid_at ? format(new Date(r.paid_at), 'd MMM yy') : '—'), sortValue: (r: any) => r.paid_at || '' },
              { key: 'gross', label: 'Gross', right: true, value: (r: any) => money(Number(r.gross || r.total || 0)), sortValue: (r: any) => Number(r.gross || r.total || 0) },
            ]}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold mt-1 tabular-nums">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}
