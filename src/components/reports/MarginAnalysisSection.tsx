import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScatterChart, Scatter, XAxis, YAxis, ZAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts';
import { money, moneyExact, pct, inRange } from '@/lib/reports';
import type { ReportsData } from '@/hooks/useReportsData';
import type { Range } from '@/lib/reports';

interface Props { data: ReportsData; range: Range }

type SortKey = 'sold_at' | 'revenue' | 'cost' | 'margin' | 'margin_pct';

export default function MarginAnalysisSection({ data, range }: Props) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'sold_at', dir: -1 });

  const rows = useMemo(() => {
    const soldBikes = data.bikes.filter(
      (b) => b.status === 'sold' && inRange(b.updated_at, range),
    );
    return soldBikes.map((b) => {
      const partsCost = data.parts
        .filter((p) => p.bike_id === b.id)
        .reduce((s, p) => s + Number(p.cost_price || 0) * Number(p.quantity || 1), 0);
      const jobsCost = data.jobs
        .filter((j) => j.bike_id === b.id)
        .reduce((s, j) => s + Number(j.actual_cost || j.estimated_cost || 0), 0);
      const cost =
        Number(b.purchase_price || b.purchase_cost || 0) +
        Number(b.collection_cost || 0) +
        Number(b.delivery_cost || 0) +
        partsCost +
        jobsCost;
      const invoice = data.invoices.find((i) => i.bike_id === b.id && i.status === 'paid');
      const revenue = Number(invoice?.gross || invoice?.total || b.sale_price || 0);
      const margin = revenue - cost;
      const margin_pct = revenue > 0 ? margin / revenue : 0;
      return {
        id: b.id,
        label: `${b.make || ''} ${b.model || ''}`.trim() || 'Bike',
        sold_at: b.updated_at,
        revenue,
        cost,
        margin,
        margin_pct,
      };
    });
  }, [data, range]);

  const sorted = useMemo(() => {
    const arr = [...rows];
    arr.sort((a, b) => {
      const av = (a as any)[sort.key];
      const bv = (b as any)[sort.key];
      if (av < bv) return -1 * sort.dir;
      if (av > bv) return 1 * sort.dir;
      return 0;
    });
    return arr;
  }, [rows, sort]);

  const totals = useMemo(() => {
    const totalRev = rows.reduce((s, r) => s + r.revenue, 0);
    const totalCost = rows.reduce((s, r) => s + r.cost, 0);
    const totalMargin = totalRev - totalCost;
    const avgMargin = rows.length ? totalMargin / rows.length : 0;
    const avgPct = totalRev > 0 ? totalMargin / totalRev : 0;
    return { totalRev, totalCost, totalMargin, avgMargin, avgPct };
  }, [rows]);

  const setSortKey = (k: SortKey) =>
    setSort((s) => (s.key === k ? { key: k, dir: (s.dir * -1) as 1 | -1 } : { key: k, dir: -1 }));

  return (
    <Card>
      <CardHeader><CardTitle>Margin & profitability</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
          <Stat label="Bikes sold" value={String(rows.length)} />
          <Stat label="Total revenue" value={money(totals.totalRev)} />
          <Stat label="Total margin" value={money(totals.totalMargin)} sub={pct(totals.avgPct)} />
          <Stat label="Avg margin / bike" value={money(totals.avgMargin)} />
        </div>

        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis type="number" dataKey="cost" name="Cost" tick={{ fontSize: 11 }} tickFormatter={(v) => `£${v}`} />
              <YAxis type="number" dataKey="revenue" name="Revenue" tick={{ fontSize: 11 }} tickFormatter={(v) => `£${v}`} />
              <ZAxis range={[60, 60]} />
              <Tooltip
                contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', fontSize: 12 }}
                formatter={(v: any, name) => name === 'cost' || name === 'revenue' ? moneyExact(Number(v)) : v}
                labelFormatter={() => ''}
              />
              <Scatter data={rows} fill="hsl(var(--primary))" />
            </ScatterChart>
          </ResponsiveContainer>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Bike</TableHead>
              <SortHead k="sold_at" sort={sort} onClick={setSortKey}>Sold</SortHead>
              <SortHead k="revenue" sort={sort} onClick={setSortKey} right>Revenue</SortHead>
              <SortHead k="cost" sort={sort} onClick={setSortKey} right>Cost</SortHead>
              <SortHead k="margin" sort={sort} onClick={setSortKey} right>Margin £</SortHead>
              <SortHead k="margin_pct" sort={sort} onClick={setSortKey} right>Margin %</SortHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">No bikes sold in this period.</TableCell></TableRow>
            )}
            {sorted.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{r.label}</TableCell>
                <TableCell>{r.sold_at ? format(new Date(r.sold_at), 'd MMM yy') : '—'}</TableCell>
                <TableCell className="text-right">{money(r.revenue)}</TableCell>
                <TableCell className="text-right">{money(r.cost)}</TableCell>
                <TableCell className={`text-right ${r.margin < 0 ? 'text-destructive' : ''}`}>{money(r.margin)}</TableCell>
                <TableCell className={`text-right ${r.margin_pct < 0 ? 'text-destructive' : ''}`}>{pct(r.margin_pct)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold mt-1">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function SortHead({ k, sort, onClick, right, children }: {
  k: SortKey; sort: { key: SortKey; dir: 1 | -1 }; onClick: (k: SortKey) => void; right?: boolean; children: React.ReactNode;
}) {
  const active = sort.key === k;
  return (
    <TableHead className={`cursor-pointer select-none ${right ? 'text-right' : ''}`} onClick={() => onClick(k)}>
      {children}{active ? (sort.dir === -1 ? ' ↓' : ' ↑') : ''}
    </TableHead>
  );
}
