import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts';
import { AGE_BUCKETS, bucketFor, daysBetween, money } from '@/lib/reports';
import type { ReportsData } from '@/hooks/useReportsData';

interface Props { data: ReportsData }

const BIKE_STOCK_STATUSES = ['in_stock', 'ready', 'listed', 'repair', 'cleaning', 'inspection', 'intake', 'pending_intake'];

export default function StockAgingSection({ data }: Props) {
  const [tab, setTab] = useState<'bikes' | 'parts'>('bikes');
  const [selectedBucket, setSelectedBucket] = useState<string | null>(null);

  const bikeStock = useMemo(
    () => data.bikes.filter((b) => BIKE_STOCK_STATUSES.includes(b.status)),
    [data.bikes],
  );
  const partStock = useMemo(
    () => data.parts.filter((p) => p.stock_status === 'in_stock' && !p.bike_id),
    [data.parts],
  );

  const bikeBuckets = useMemo(() => {
    const map = new Map<string, { count: number; value: number }>();
    for (const b of AGE_BUCKETS) map.set(b.label, { count: 0, value: 0 });
    for (const b of bikeStock) {
      const age = daysBetween(b.intake_date || b.created_at);
      const key = bucketFor(age);
      const cur = map.get(key)!;
      cur.count += 1;
      cur.value += Number(b.purchase_price || b.purchase_cost || 0);
    }
    return AGE_BUCKETS.map((b) => ({ label: b.label, ...map.get(b.label)! }));
  }, [bikeStock]);

  const partBuckets = useMemo(() => {
    const map = new Map<string, { count: number; value: number }>();
    for (const b of AGE_BUCKETS) map.set(b.label, { count: 0, value: 0 });
    for (const p of partStock) {
      const age = daysBetween(p.created_at);
      const key = bucketFor(age);
      const cur = map.get(key)!;
      cur.count += Number(p.quantity || 1);
      cur.value += Number(p.cost_price || 0) * Number(p.quantity || 1);
    }
    return AGE_BUCKETS.map((b) => ({ label: b.label, ...map.get(b.label)! }));
  }, [partStock]);

  const drillRows = useMemo(() => {
    if (!selectedBucket) return [];
    if (tab === 'bikes') {
      return bikeStock
        .map((b) => ({ ...b, _age: daysBetween(b.intake_date || b.created_at) }))
        .filter((b) => bucketFor(b._age) === selectedBucket)
        .sort((a, b) => b._age - a._age);
    }
    return partStock
      .map((p) => ({ ...p, _age: daysBetween(p.created_at) }))
      .filter((p) => bucketFor(p._age) === selectedBucket)
      .sort((a, b) => b._age - a._age);
  }, [selectedBucket, tab, bikeStock, partStock]);

  const buckets = tab === 'bikes' ? bikeBuckets : partBuckets;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Stock aging</CardTitle>
        <CardDescription>Snapshot as of today — not filtered by timeframe. Click a bar to drill down.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={tab} onValueChange={(v) => { setTab(v as 'bikes' | 'parts'); setSelectedBucket(null); }}>
          <TabsList>
            <TabsTrigger value="bikes">Bikes</TabsTrigger>
            <TabsTrigger value="parts">Parts</TabsTrigger>
          </TabsList>
          <TabsContent value={tab} className="mt-4 space-y-4">
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={buckets}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', fontSize: 12 }}
                    formatter={(v: any, name) => name === 'value' ? money(Number(v)) : v}
                  />
                  <Bar
                    dataKey="count"
                    fill="hsl(var(--primary))"
                    radius={[4, 4, 0, 0]}
                    cursor="pointer"
                    onClick={(d: any) => setSelectedBucket(d?.label || null)}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Age bucket</TableHead>
                  <TableHead className="text-right">Units</TableHead>
                  <TableHead className="text-right">Value at cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {buckets.map((b) => (
                  <TableRow
                    key={b.label}
                    onClick={() => setSelectedBucket(selectedBucket === b.label ? null : b.label)}
                    className={`cursor-pointer ${selectedBucket === b.label ? 'bg-muted/50' : ''}`}
                  >
                    <TableCell>{b.label} days</TableCell>
                    <TableCell className="text-right">{b.count}</TableCell>
                    <TableCell className="text-right">{money(b.value)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {selectedBucket && drillRows.length > 0 && (
              <div className="border rounded-md">
                <div className="px-3 py-2 text-sm font-medium border-b bg-muted/30">
                  {selectedBucket} days — {drillRows.length} item{drillRows.length === 1 ? '' : 's'}
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{tab === 'bikes' ? 'Bike' : 'Part'}</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Age (days)</TableHead>
                      <TableHead className="text-right">Cost</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {drillRows.slice(0, 50).map((r: any) => (
                      <TableRow key={r.id}>
                        <TableCell>{tab === 'bikes' ? `${r.make || ''} ${r.model || ''}`.trim() : r.description}</TableCell>
                        <TableCell className="text-xs">{tab === 'bikes' ? r.status : r.stock_status}</TableCell>
                        <TableCell className="text-right">{r._age}</TableCell>
                        <TableCell className="text-right">
                          {money(tab === 'bikes'
                            ? Number(r.purchase_price || r.purchase_cost || 0)
                            : Number(r.cost_price || 0) * Number(r.quantity || 1))}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
