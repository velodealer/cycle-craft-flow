import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import ReportTable from './ReportTable';
import { groupColumns } from './BrandAnalyticsSection';
import { autoGranularity, bucketDate, formatBucket, inRange, type Range } from '@/lib/reports';
import { groupStats, soldIn, type BikeRow } from '@/lib/reportMetrics';
import type { ReportsData } from '@/hooks/useReportsData';

interface Props { rows: BikeRow[]; data: ReportsData; range: Range }

export default function AcquisitionSection({ rows, data, range }: Props) {
  const sold = useMemo(() => soldIn(rows, range), [rows, range]);
  const bySource = useMemo(() => groupStats(rows, sold, (r) => r.source), [rows, sold]);
  const byRoute = useMemo(() => groupStats(rows, sold, (r) => r.acquiredVia), [rows, sold]);

  const balance = useMemo(() => {
    const g = autoGranularity(range);
    const map = new Map<number, any>();
    const touch = (d: Date) => {
      const b = bucketDate(d, g);
      const key = b.getTime();
      const row = map.get(key) || { _t: key, label: formatBucket(b, g), intake: 0, sold: 0 };
      map.set(key, row);
      return row;
    };
    for (const r of rows) if (inRange(r.intakeDate, range)) touch(new Date(r.intakeDate as string)).intake += 1;
    for (const r of sold) touch(new Date(r.saleDate as string)).sold += 1;
    return Array.from(map.values()).sort((a, b) => a._t - b._t);
  }, [rows, sold, range]);

  const channels = useMemo(() => {
    const ids = new Set(rows.map((r) => r.id));
    const live = (list: any[]) => list.filter((l) => ids.has(l.bike_id));
    return [
      { channel: 'eBay', listed: live(data.ebay).length, active: live(data.ebay).filter((l) => l.status === 'active' || l.status === 'published').length },
      { channel: 'Shopify', listed: live(data.shopify).length, active: live(data.shopify).filter((l) => l.status === 'active' || l.status === 'published').length },
    ];
  }, [rows, data.ebay, data.shopify]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Buying vs selling</CardTitle>
          <CardDescription>Are you taking bikes in faster than they leave?</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={balance}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="intake" name="Taken in" fill="hsl(var(--muted-foreground))" radius={[3, 3, 0, 0]} />
                <Bar dataKey="sold" name="Sold" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>By ownership</CardTitle><CardDescription>Owned stock, consignment and investor bikes.</CardDescription></CardHeader>
        <CardContent>
          <ReportTable rows={bySource} rowKey={(r) => r.key} csvName="by-source" initialSort="sold" columns={groupColumns('Source')} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>By acquisition route</CardTitle><CardDescription>Direct purchase, part exchange and everything else.</CardDescription></CardHeader>
        <CardContent>
          <ReportTable rows={byRoute} rowKey={(r) => r.key} csvName="by-acquisition" initialSort="sold" columns={groupColumns('Route')} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Listing channels</CardTitle></CardHeader>
        <CardContent>
          <ReportTable
            rows={channels}
            rowKey={(r) => r.channel}
            csvName="channels"
            initialSort="listed"
            empty="No marketplace listings yet."
            columns={[
              { key: 'channel', label: 'Channel', value: (r) => r.channel },
              { key: 'listed', label: 'Listings', right: true, value: (r) => r.listed },
              { key: 'active', label: 'Live now', right: true, value: (r) => r.active },
            ]}
          />
        </CardContent>
      </Card>
    </div>
  );
}
