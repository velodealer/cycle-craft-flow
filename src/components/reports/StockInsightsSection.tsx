import { useMemo } from 'react';
import { differenceInCalendarDays } from 'date-fns';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import ReportTable from './ReportTable';
import {
  AGE_BUCKETS, bucketFor, inRange, money, num, sum, titleCase, type Range,
} from '@/lib/reports';
import { soldIn, type BikeRow } from '@/lib/reportMetrics';
import type { ReportsData } from '@/hooks/useReportsData';

interface Props { rows: BikeRow[]; data: ReportsData; range: Range }

export default function StockInsightsSection({ rows, data, range }: Props) {
  const stock = useMemo(() => rows.filter((r) => r.isStock), [rows]);
  const sold = useMemo(() => soldIn(rows, range), [rows, range]);

  const ageBuckets = useMemo(() => {
    const map = new Map<string, { count: number; cost: number; asking: number }>();
    for (const b of AGE_BUCKETS) map.set(b.label, { count: 0, cost: 0, asking: 0 });
    for (const r of stock) {
      const cur = map.get(bucketFor(r.ageDays))!;
      cur.count += 1;
      cur.cost += r.purchaseCost;
      cur.asking += r.askingPrice;
    }
    return AGE_BUCKETS.map((b) => ({ label: b.label, ...map.get(b.label)! }));
  }, [stock]);

  const byStage = useMemo(() => {
    const map = new Map<string, { stage: string; count: number; value: number }>();
    for (const r of stock) {
      const key = titleCase(r.status);
      const cur = map.get(key) || { stage: key, count: 0, value: 0 };
      cur.count += 1;
      cur.value += r.purchaseCost;
      map.set(key, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [stock]);

  const byBay = useMemo(() => {
    const names = new Map(data.bays.map((b: any) => [b.id, b.zone ? `${b.name} (${b.zone})` : b.name]));
    const map = new Map<string, { bay: string; count: number; value: number }>();
    for (const r of stock) {
      const key = (r.bayId && names.get(r.bayId)) || 'Unassigned';
      const cur = map.get(key) || { bay: key, count: 0, value: 0 };
      cur.count += 1;
      cur.value += r.purchaseCost;
      map.set(key, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [stock, data.bays]);

  const daysHistogram = useMemo(() => {
    const bands = [
      { label: '0–14', min: 0, max: 14 }, { label: '15–30', min: 15, max: 30 },
      { label: '31–60', min: 31, max: 60 }, { label: '61–90', min: 61, max: 90 },
      { label: '91–180', min: 91, max: 180 }, { label: '180+', min: 181, max: Infinity },
    ];
    return bands.map((b) => ({
      label: b.label,
      count: sold.filter((r) => (r.daysToSell ?? -1) >= b.min && (r.daysToSell ?? -1) <= b.max).length,
    }));
  }, [sold]);

  const stockTrend = useMemo(() => {
    const points: { label: string; units: number; value: number }[] = [];
    const span = Math.max(1, differenceInCalendarDays(range.to, range.from));
    const steps = Math.min(12, Math.max(4, Math.round(span / 14)));
    for (let i = 0; i <= steps; i++) {
      const t = new Date(range.from.getTime() + ((range.to.getTime() - range.from.getTime()) / steps) * i);
      const held = rows.filter((r) => {
        const intake = r.intakeDate ? new Date(r.intakeDate).getTime() : Infinity;
        if (intake > t.getTime()) return false;
        if (r.isSold && r.saleDate && new Date(r.saleDate).getTime() <= t.getTime()) return false;
        return true;
      });
      points.push({
        label: t.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
        units: held.length,
        value: sum(held, (r) => r.purchaseCost),
      });
    }
    return points;
  }, [rows, range]);

  const watchlist = useMemo(() => [...stock].sort((a, b) => b.ageDays - a.ageDays).slice(0, 40), [stock]);
  const intakeCount = rows.filter((r) => inRange(r.intakeDate, range)).length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Stock ageing</CardTitle>
            <CardDescription>Units held today by how long they've been in stock.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ageBuckets}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', fontSize: 12 }} />
                  <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                    {ageBuckets.map((b, i) => (
                      <Cell key={b.label} fill={i >= 3 ? 'hsl(var(--destructive))' : 'hsl(var(--primary))'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <ReportTable
              rows={ageBuckets}
              rowKey={(r) => r.label}
              csvName="stock-ageing"
              initialSort="label"
              columns={[
                { key: 'label', label: 'Age (days)', value: (r) => r.label },
                { key: 'count', label: 'Units', right: true, value: (r) => r.count },
                { key: 'cost', label: 'At cost', right: true, value: (r) => money(r.cost), sortValue: (r) => r.cost },
                { key: 'asking', label: 'At asking', right: true, value: (r) => money(r.asking), sortValue: (r) => r.asking },
              ]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Days to sell</CardTitle>
            <CardDescription>How long sold bikes took from intake to sale.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={daysHistogram}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', fontSize: 12 }} />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Stock held over the period</CardTitle>
          <CardDescription>{intakeCount} bikes taken in, {sold.length} sold during this period.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stockTrend}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', fontSize: 12 }}
                  formatter={(v: any, n: any) => (n === 'value' ? money(Number(v)) : v)}
                />
                <Bar dataKey="units" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Stock by stage</CardTitle></CardHeader>
          <CardContent>
            <ReportTable
              rows={byStage}
              rowKey={(r) => r.stage}
              csvName="stock-by-stage"
              initialSort="count"
              columns={[
                { key: 'stage', label: 'Stage', value: (r) => r.stage },
                { key: 'count', label: 'Units', right: true, value: (r) => r.count },
                { key: 'value', label: 'Value at cost', right: true, value: (r) => money(r.value), sortValue: (r) => r.value },
              ]}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Stock by bay</CardTitle></CardHeader>
          <CardContent>
            <ReportTable
              rows={byBay}
              rowKey={(r) => r.bay}
              csvName="stock-by-bay"
              initialSort="count"
              columns={[
                { key: 'bay', label: 'Bay', value: (r) => r.bay },
                { key: 'count', label: 'Units', right: true, value: (r) => r.count },
                { key: 'value', label: 'Value at cost', right: true, value: (r) => money(r.value), sortValue: (r) => r.value },
              ]}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ageing watchlist</CardTitle>
          <CardDescription>Oldest stock first — money sitting still.</CardDescription>
        </CardHeader>
        <CardContent>
          <ReportTable
            rows={watchlist}
            rowKey={(r) => r.id}
            csvName="ageing-watchlist"
            initialSort="ageDays"
            columns={[
              { key: 'label', label: 'Bike', value: (r) => r.label },
              { key: 'status', label: 'Stage', value: (r) => titleCase(r.status) },
              { key: 'size', label: 'Size', value: (r) => r.size },
              { key: 'ageDays', label: 'Days held', right: true, value: (r) => r.ageDays, className: (r) => (r.ageDays > 90 ? 'text-destructive' : '') },
              { key: 'purchaseCost', label: 'Cost', right: true, value: (r) => money(r.purchaseCost), sortValue: (r) => r.purchaseCost },
              { key: 'prepCost', label: 'Prep so far', right: true, value: (r) => money(r.prepCost), sortValue: (r) => r.prepCost },
              { key: 'askingPrice', label: 'Asking', right: true, value: (r) => money(r.askingPrice), sortValue: (r) => r.askingPrice },
              { key: 'potential', label: 'Potential margin', right: true, value: (r) => money(r.askingPrice - r.totalCost), sortValue: (r) => r.askingPrice - r.totalCost },
            ]}
          />
          <p className="text-xs text-muted-foreground mt-2">
            Average age of current stock: {stock.length ? num(sum(stock, (r) => r.ageDays) / stock.length, 0) : '—'} days.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
