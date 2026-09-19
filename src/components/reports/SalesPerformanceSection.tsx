import { useMemo, useState } from 'react';
import {
  Area, Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import ReportTable from './ReportTable';
import {
  autoGranularity, bucketDate, formatBucket, inRange, money, type Granularity, type Range,
} from '@/lib/reports';
import { soldIn, type BikeRow } from '@/lib/reportMetrics';
import type { ReportsData } from '@/hooks/useReportsData';

interface Props { rows: BikeRow[]; data: ReportsData; range: Range; compareRange: Range | null }

const TYPES = ['sale', 'service', 'detailing'] as const;
const COLOURS: Record<string, string> = {
  sale: 'hsl(var(--primary))',
  service: 'hsl(var(--chart-2, 200 70% 50%))',
  detailing: 'hsl(var(--chart-3, 30 80% 55%))',
};

export default function SalesPerformanceSection({ rows, data, range, compareRange }: Props) {
  const [granOverride, setGranOverride] = useState<Granularity | 'auto'>('auto');
  const granularity: Granularity = granOverride === 'auto' ? autoGranularity(range) : granOverride;

  const bikeIds = useMemo(() => new Set(rows.map((r) => r.id)), [rows]);

  const series = useMemo(() => {
    const build = (r: Range) => {
      const buckets = new Map<number, any>();
      const invoices = data.invoices.filter(
        (i) => i.status === 'paid' && inRange(i.paid_at, r) && (!i.bike_id || bikeIds.has(i.bike_id)),
      );
      for (const inv of invoices) {
        const d = bucketDate(new Date(inv.paid_at), granularity);
        const key = d.getTime();
        const row = buckets.get(key) || { _t: key, label: formatBucket(d, granularity), sale: 0, service: 0, detailing: 0, units: 0 };
        row[inv.type] = (row[inv.type] || 0) + Number(inv.gross || inv.total || 0);
        buckets.set(key, row);
      }
      for (const b of soldIn(rows, r)) {
        const d = bucketDate(new Date(b.saleDate as string), granularity);
        const key = d.getTime();
        const row = buckets.get(key) || { _t: key, label: formatBucket(d, granularity), sale: 0, service: 0, detailing: 0, units: 0 };
        row.units += 1;
        buckets.set(key, row);
      }
      const arr = Array.from(buckets.values()).sort((a, b) => a._t - b._t);
      let cum = 0;
      for (const x of arr) {
        x.total = (x.sale || 0) + (x.service || 0) + (x.detailing || 0);
        cum += x.total;
        x.cumulative = cum;
      }
      return arr;
    };

    const current = build(range);
    if (!compareRange) return current;
    const prior = build(compareRange);
    return current.map((row, idx) => ({ ...row, compare: prior[idx]?.total ?? null, compareCum: prior[idx]?.cumulative ?? null }));
  }, [data.invoices, rows, bikeIds, range, compareRange, granularity]);

  const totalRevenue = series.reduce((s, r) => s + (r.total || 0), 0);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center justify-between gap-2">
            <span>Revenue & units over time</span>
            <span className="text-sm font-normal text-muted-foreground">{money(totalRevenue)} in period</span>
          </CardTitle>
          <CardDescription>Revenue split by invoice type, with units sold and cumulative pace.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {(['auto', 'day', 'week', 'month', 'quarter'] as const).map((g) => (
              <Button key={g} size="sm" variant={granOverride === g ? 'default' : 'outline'} onClick={() => setGranOverride(g)}>
                {g === 'auto' ? `Auto (${granularity})` : g}
              </Button>
            ))}
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={series}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 11 }} tickFormatter={(v) => `£${Math.round(Number(v) / 1000)}k`} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', fontSize: 12 }}
                  formatter={(v: any, n: any) => (n === 'units' ? v : money(Number(v)))}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {TYPES.map((t) => (
                  <Area key={t} yAxisId="left" type="monotone" dataKey={t} stackId="1" stroke={COLOURS[t]} fill={COLOURS[t]} fillOpacity={0.35} />
                ))}
                <Bar yAxisId="right" dataKey="units" fill="hsl(var(--muted-foreground))" fillOpacity={0.45} radius={[3, 3, 0, 0]} />
                <Line yAxisId="left" type="monotone" dataKey="cumulative" stroke="hsl(var(--foreground))" strokeWidth={2} dot={false} />
                {compareRange && (
                  <Line yAxisId="left" type="monotone" dataKey="compare" stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" strokeWidth={2} dot={false} name="comparison" />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Period breakdown</CardTitle>
          <CardDescription>Every bucket in the selected period, best to worst.</CardDescription>
        </CardHeader>
        <CardContent>
          <ReportTable
            rows={series}
            rowKey={(r: any) => String(r._t)}
            csvName="revenue-by-period"
            initialSort="total"
            columns={[
              { key: 'label', label: 'Period', value: (r: any) => r.label, sortValue: (r: any) => r._t },
              { key: 'units', label: 'Units', right: true, value: (r: any) => r.units || 0 },
              { key: 'sale', label: 'Bike sales', right: true, value: (r: any) => money(r.sale || 0), sortValue: (r: any) => r.sale || 0 },
              { key: 'service', label: 'Service', right: true, value: (r: any) => money(r.service || 0), sortValue: (r: any) => r.service || 0 },
              { key: 'detailing', label: 'Detailing', right: true, value: (r: any) => money(r.detailing || 0), sortValue: (r: any) => r.detailing || 0 },
              { key: 'total', label: 'Total', right: true, value: (r: any) => money(r.total || 0), sortValue: (r: any) => r.total || 0 },
            ]}
          />
        </CardContent>
      </Card>
    </div>
  );
}
