import { useMemo } from 'react';
import MetricCard from './MetricCard';
import { delta, money, num, pct, type Range } from '@/lib/reports';
import { periodStats, type BikeRow } from '@/lib/reportMetrics';
import type { ReportsData } from '@/hooks/useReportsData';

interface Props {
  rows: BikeRow[];
  data: ReportsData;
  range: Range;
  compareRange: Range | null;
}

export default function KpiStrip({ rows, data, range, compareRange }: Props) {
  const cur = useMemo(() => periodStats(rows, data, range), [rows, data, range]);
  const prev = useMemo(() => (compareRange ? periodStats(rows, data, compareRange) : null), [rows, data, compareRange]);

  const d = (k: keyof typeof cur) => (prev ? delta(cur[k] as number, prev[k] as number) : null);

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
      <MetricCard label="Revenue" value={money(cur.revenue)} delta={d('revenue')} sub="paid in period" />
      <MetricCard label="Units sold" value={String(cur.units)} delta={d('units')} sub={`${cur.intakeUnits} taken in`} />
      <MetricCard label="Gross profit" value={money(cur.grossProfit)} delta={d('grossProfit')} sub={pct(cur.marginPct)} />
      <MetricCard label="Profit / unit" value={money(cur.avgProfit)} delta={d('avgProfit')} sub={`avg sale ${money(cur.avgSalePrice)}`} />
      <MetricCard label="Days to sell" value={cur.avgDaysToSell ? num(cur.avgDaysToSell, 0) : '—'} delta={d('avgDaysToSell')} invert sub="average" />
      <MetricCard label="Prep cost / unit" value={money(cur.avgPrepCost)} delta={d('avgPrepCost')} invert sub="parts + labour" />
      <MetricCard label="Stock units" value={String(cur.stockUnits)} sub={`${money(cur.stockValue)} at cost`} />
      <MetricCard label="Ageing 90+" value={String(cur.agingUnits)} sub={`${money(cur.agingValue)} tied up`} />
      <MetricCard label="Sell-through" value={pct(cur.sellThrough)} delta={d('sellThrough')} sub="sold vs stock held" />
      <MetricCard label="Service revenue" value={money(cur.serviceRevenue)} delta={d('serviceRevenue')} sub="workshop & detailing" />
      <MetricCard label="Stock value" value={money(cur.stockValue)} sub="purchase price only" />
      <MetricCard label="Intake" value={String(cur.intakeUnits)} delta={d('intakeUnits')} sub="bikes bought in" />
    </div>
  );
}
