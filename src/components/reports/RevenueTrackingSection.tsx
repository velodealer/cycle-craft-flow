import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, Legend, Line, ComposedChart } from 'recharts';
import { autoGranularity, bucketDate, formatBucket, inRange, money, type Granularity } from '@/lib/reports';
import type { ReportsData } from '@/hooks/useReportsData';
import type { Range } from '@/lib/reports';

interface Props { data: ReportsData; range: Range }

const TYPES = ['sale', 'service', 'detailing'] as const;
const COLOURS: Record<string, string> = {
  sale: 'hsl(var(--primary))',
  service: 'hsl(var(--chart-2, 200 70% 50%))',
  detailing: 'hsl(var(--chart-3, 30 80% 55%))',
};

export default function RevenueTrackingSection({ data, range }: Props) {
  const [granOverride, setGranOverride] = useState<Granularity | 'auto'>('auto');
  const granularity: Granularity = granOverride === 'auto' ? autoGranularity(range) : granOverride;

  const chartData = useMemo(() => {
    const buckets = new Map<number, any>();
    const invoices = data.invoices.filter((i) => i.status === 'paid' && inRange(i.paid_at, range));
    for (const inv of invoices) {
      const d = bucketDate(new Date(inv.paid_at), granularity);
      const key = d.getTime();
      const row = buckets.get(key) || { _t: key, label: formatBucket(d, granularity), sale: 0, service: 0, detailing: 0 };
      const amt = Number(inv.gross || inv.total || 0);
      row[inv.type] = (row[inv.type] || 0) + amt;
      buckets.set(key, row);
    }
    const arr = Array.from(buckets.values()).sort((a, b) => a._t - b._t);
    let cum = 0;
    for (const r of arr) {
      r.total = (r.sale || 0) + (r.service || 0) + (r.detailing || 0);
      cum += r.total;
      r.cumulative = cum;
    }
    return arr;
  }, [data.invoices, range, granularity]);

  const totalRevenue = chartData.reduce((s, r) => s + r.total, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Revenue tracking</span>
          <span className="text-sm font-normal text-muted-foreground">{money(totalRevenue)} in range</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          {(['auto', 'day', 'week', 'month'] as const).map((g) => (
            <Button
              key={g}
              size="sm"
              variant={granOverride === g ? 'default' : 'outline'}
              onClick={() => setGranOverride(g)}
            >
              {g === 'auto' ? `Auto (${granularity})` : g}
            </Button>
          ))}
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `£${Math.round(Number(v) / 1000)}k`} />
              <Tooltip
                contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', fontSize: 12 }}
                formatter={(v: any) => money(Number(v))}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {TYPES.map((t) => (
                <Area key={t} type="monotone" dataKey={t} stackId="1" stroke={COLOURS[t]} fill={COLOURS[t]} fillOpacity={0.4} />
              ))}
              <Line type="monotone" dataKey="cumulative" stroke="hsl(var(--foreground))" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
