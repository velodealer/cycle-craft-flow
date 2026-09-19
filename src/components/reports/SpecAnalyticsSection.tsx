import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ReportTable from './ReportTable';
import { groupColumns } from './BrandAnalyticsSection';
import { money, type Range } from '@/lib/reports';
import { groupStats, soldIn, type BikeRow } from '@/lib/reportMetrics';

interface Props { rows: BikeRow[]; range: Range }

const DIMENSIONS = [
  { id: 'groupset', label: 'Groupset', key: (r: BikeRow) => r.groupset },
  { id: 'size', label: 'Size', key: (r: BikeRow) => r.size },
  { id: 'type', label: 'Bike type', key: (r: BikeRow) => r.bikeType },
  { id: 'material', label: 'Frame material', key: (r: BikeRow) => r.frameMaterial },
  { id: 'electric', label: 'Electric', key: (r: BikeRow) => (r.isElectric ? 'Electric' : 'Non-electric') },
  { id: 'band', label: 'Price band', key: (r: BikeRow) => r.priceBand },
] as const;

export default function SpecAnalyticsSection({ rows, range }: Props) {
  const [dim, setDim] = useState<string>('groupset');
  const sold = useMemo(() => soldIn(rows, range), [rows, range]);
  const def = DIMENSIONS.find((d) => d.id === dim) || DIMENSIONS[0];
  const stats = useMemo(() => groupStats(rows, sold, def.key), [rows, sold, def]);

  const chart = useMemo(
    () => [...stats].sort((a, b) => b.avgSale - a.avgSale).slice(0, 14)
      .map((s) => ({ name: s.key, avgSale: Math.round(s.avgSale), avgMargin: Math.round(s.avgMargin), avgDays: Math.round(s.avgDays) })),
    [stats],
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Specification analytics</CardTitle>
          <CardDescription>What each specification actually sells for, earns and how quickly it moves.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs value={dim} onValueChange={setDim}>
            <TabsList className="flex-wrap h-auto">
              {DIMENSIONS.map((d) => <TabsTrigger key={d.id} value={d.id}>{d.label}</TabsTrigger>)}
            </TabsList>
          </Tabs>

          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-25} textAnchor="end" height={60} />
                <YAxis yAxisId="left" tick={{ fontSize: 11 }} tickFormatter={(v) => `£${v}`} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', fontSize: 12 }}
                  formatter={(v: any, n: any) => (n === 'avgDays' ? `${v} days` : money(Number(v)))}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar yAxisId="left" dataKey="avgSale" name="Avg sale" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                <Bar yAxisId="left" dataKey="avgMargin" name="Avg margin" fill="hsl(var(--chart-2, 200 70% 50%))" radius={[3, 3, 0, 0]} />
                <Bar yAxisId="right" dataKey="avgDays" name="Avg days to sell" fill="hsl(var(--muted-foreground))" fillOpacity={0.5} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <ReportTable
            rows={stats}
            rowKey={(r) => r.key}
            csvName={`spec-${dim}`}
            initialSort="sold"
            columns={groupColumns(def.label)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
