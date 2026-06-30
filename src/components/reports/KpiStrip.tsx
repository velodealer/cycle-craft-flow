import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { money, pct, inRange } from '@/lib/reports';
import type { ReportsData } from '@/hooks/useReportsData';
import type { Range } from '@/lib/reports';

interface Props {
  data: ReportsData;
  range: Range;
}

export default function KpiStrip({ data, range }: Props) {
  const stats = useMemo(() => {
    const paidInvoices = data.invoices.filter(
      (i) => i.status === 'paid' && inRange(i.paid_at, range),
    );
    const revenue = paidInvoices.reduce((s, i) => s + Number(i.gross || i.total || 0), 0);

    const soldBikes = data.bikes.filter(
      (b) => b.status === 'sold' && inRange(b.updated_at, range),
    );
    const bikesSold = soldBikes.length;

    let cost = 0;
    let saleTotal = 0;
    for (const b of soldBikes) {
      const partsCost = data.parts
        .filter((p) => p.bike_id === b.id)
        .reduce((s, p) => s + Number(p.cost_price || 0) * Number(p.quantity || 1), 0);
      const jobsCost = data.jobs
        .filter((j) => j.bike_id === b.id)
        .reduce((s, j) => s + Number(j.actual_cost || j.estimated_cost || 0), 0);
      const c =
        Number(b.purchase_price || b.purchase_cost || 0) +
        Number(b.collection_cost || 0) +
        Number(b.delivery_cost || 0) +
        partsCost +
        jobsCost;
      cost += c;
      saleTotal += Number(b.sale_price || 0);
    }
    const margin = revenue - cost;
    const marginPct = revenue > 0 ? margin / revenue : 0;

    const stockValue = data.bikes
      .filter((b) => ['in_stock', 'ready', 'listed', 'repair', 'cleaning', 'inspection', 'intake'].includes(b.status))
      .reduce((s, b) => s + Number(b.purchase_price || b.purchase_cost || 0), 0)
      + data.parts
        .filter((p) => p.stock_status === 'in_stock' && !p.bike_id)
        .reduce((s, p) => s + Number(p.cost_price || 0) * Number(p.quantity || 1), 0);

    return { revenue, bikesSold, margin, marginPct, stockValue, saleTotal };
  }, [data, range]);

  const items = [
    { label: 'Revenue', value: money(stats.revenue), sub: 'Paid invoices in range' },
    { label: 'Bikes sold', value: String(stats.bikesSold), sub: money(stats.saleTotal) + ' booked' },
    { label: 'Gross margin', value: money(stats.margin), sub: pct(stats.marginPct) },
    { label: 'Stock value', value: money(stats.stockValue), sub: 'At cost, today' },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {items.map((i) => (
        <Card key={i.label}>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{i.label}</p>
            <p className="text-2xl font-semibold mt-1">{i.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{i.sub}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
