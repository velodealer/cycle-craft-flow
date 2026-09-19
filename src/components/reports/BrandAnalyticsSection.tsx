import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import ReportTable, { type Column } from './ReportTable';
import { money, num, pct, type Range } from '@/lib/reports';
import { groupStats, soldIn, type BikeRow, type GroupStat } from '@/lib/reportMetrics';

interface Props { rows: BikeRow[]; range: Range }

export const groupColumns = (label: string): Column<GroupStat>[] => [
  { key: 'key', label, value: (r) => r.key },
  { key: 'sold', label: 'Sold', right: true, value: (r) => r.sold },
  { key: 'avgBuy', label: 'Avg buy', right: true, value: (r) => money(r.avgBuy), sortValue: (r) => r.avgBuy },
  { key: 'avgSale', label: 'Avg sale', right: true, value: (r) => money(r.avgSale), sortValue: (r) => r.avgSale },
  { key: 'avgMargin', label: 'Avg margin', right: true, value: (r) => money(r.avgMargin), sortValue: (r) => r.avgMargin },
  { key: 'marginPct', label: 'Margin %', right: true, value: (r) => pct(r.marginPct), sortValue: (r) => r.marginPct },
  { key: 'avgDays', label: 'Avg days', right: true, value: (r) => (r.avgDays ? num(r.avgDays, 0) : '—'), sortValue: (r) => r.avgDays },
  { key: 'inStock', label: 'In stock', right: true, value: (r) => r.inStock },
  { key: 'aging', label: '90+ days', right: true, value: (r) => r.aging },
  { key: 'stockValue', label: 'Stock value', right: true, value: (r) => money(r.stockValue), sortValue: (r) => r.stockValue },
];

export default function BrandAnalyticsSection({ rows, range }: Props) {
  const [brand, setBrand] = useState<string | null>(null);
  const sold = useMemo(() => soldIn(rows, range), [rows, range]);

  const brands = useMemo(() => groupStats(rows, sold, (r) => r.brand), [rows, sold]);
  const models = useMemo(() => {
    if (!brand) return [];
    return groupStats(rows.filter((r) => r.brand === brand), sold.filter((r) => r.brand === brand), (r) => r.model);
  }, [brand, rows, sold]);

  const chart = useMemo(
    () => [...brands].sort((a, b) => b.margin - a.margin).slice(0, 12).map((b) => ({ name: b.key, margin: b.margin, revenue: b.revenue })),
    [brands],
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Brand profit</CardTitle>
          <CardDescription>Top brands by gross profit earned in the period.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart} layout="vertical" margin={{ left: 40 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `£${Math.round(Number(v) / 1000)}k`} />
                <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', fontSize: 12 }}
                  formatter={(v: any) => money(Number(v))}
                />
                <Bar dataKey="margin" fill="hsl(var(--primary))" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Brand performance</CardTitle>
          <CardDescription>Click a brand to see its models.</CardDescription>
        </CardHeader>
        <CardContent>
          <ReportTable
            rows={brands}
            rowKey={(r) => r.key}
            csvName="brand-performance"
            initialSort="sold"
            columns={groupColumns('Brand')}
            onRowClick={(r) => setBrand(brand === r.key ? null : r.key)}
          />
        </CardContent>
      </Card>

      {brand && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>{brand} — models</span>
              <Button size="sm" variant="ghost" onClick={() => setBrand(null)}>Close</Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ReportTable rows={models} rowKey={(r) => r.key} csvName={`${brand}-models`} initialSort="sold" columns={groupColumns('Model')} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
