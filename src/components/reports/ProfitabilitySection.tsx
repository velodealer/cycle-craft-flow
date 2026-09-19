import { useMemo } from 'react';
import { format } from 'date-fns';
import {
  Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import ReportTable from './ReportTable';
import { avg, money, moneyExact, pct, sum, type Range } from '@/lib/reports';
import { groupStats, soldIn, type BikeRow } from '@/lib/reportMetrics';
import { useVatRegistered } from '@/hooks/useVatRegistered';

interface Props { rows: BikeRow[]; range: Range }

const MARGIN_BANDS = [
  { label: 'Loss', min: -Infinity, max: 0 },
  { label: '£0–100', min: 0, max: 100 },
  { label: '£100–250', min: 100, max: 250 },
  { label: '£250–500', min: 250, max: 500 },
  { label: '£500–1k', min: 500, max: 1000 },
  { label: '£1k+', min: 1000, max: Infinity },
];

export default function ProfitabilitySection({ rows, range }: Props) {
  const sold = useMemo(() => soldIn(rows, range), [rows, range]);

  const waterfall = useMemo(() => {
    const revenue = sum(sold, (r) => r.revenue);
    const purchase = sum(sold, (r) => r.purchaseCost);
    const logistics = sum(sold, (r) => r.logisticsCost);
    const parts = sum(sold, (r) => r.partsCost);
    const labour = sum(sold, (r) => r.labourCost);
    const profit = revenue - purchase - logistics - parts - labour;
    return [
      { name: 'Revenue', value: revenue, tone: 'pos' },
      { name: 'Purchase', value: -purchase, tone: 'neg' },
      { name: 'Logistics', value: -logistics, tone: 'neg' },
      { name: 'Parts', value: -parts, tone: 'neg' },
      { name: 'Labour', value: -labour, tone: 'neg' },
      { name: 'Gross profit', value: profit, tone: profit >= 0 ? 'pos' : 'neg' },
    ];
  }, [sold]);

  const histogram = useMemo(
    () => MARGIN_BANDS.map((b) => ({
      label: b.label,
      count: sold.filter((r) => r.margin >= b.min && r.margin < b.max).length,
    })),
    [sold],
  );

  const bySchemeRows = useMemo(() => groupStats(rows, sold, (r) => r.scheme), [rows, sold]);

  const frontBack = useMemo(() => {
    const front = sum(sold, (r) => r.revenue - r.purchaseCost - r.logisticsCost);
    const back = -sum(sold, (r) => r.prepCost);
    return { front, back, prepAvg: avg(sold, (r) => r.prepCost) };
  }, [sold]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Where the money goes</CardTitle>
          <CardDescription>Every pound sold in the period, from sale price down to gross profit.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={waterfall}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `£${Math.round(Number(v) / 1000)}k`} />
                <Tooltip
                  contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', fontSize: 12 }}
                  formatter={(v: any) => moneyExact(Math.abs(Number(v)))}
                />
                <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                  {waterfall.map((w) => (
                    <Cell key={w.name} fill={w.tone === 'pos' ? 'hsl(var(--primary))' : 'hsl(var(--destructive))'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
            <Stat label="Front-end margin" value={money(frontBack.front)} sub="sale less buy & logistics" />
            <Stat label="Recon spend" value={money(Math.abs(frontBack.back))} sub={`${money(frontBack.prepAvg)} per bike`} />
            <Stat label="Gross profit" value={money(frontBack.front + frontBack.back)} />
            <Stat label="Units sold" value={String(sold.length)} />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Margin distribution</CardTitle>
            <CardDescription>How many bikes land in each profit band.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={histogram}>
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

        <Card>
          <CardHeader>
            <CardTitle>Prep spend vs margin</CardTitle>
            <CardDescription>Does spending more in the workshop earn more on the sale?</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" dataKey="prepCost" name="Prep" tick={{ fontSize: 11 }} tickFormatter={(v) => `£${v}`} />
                  <YAxis type="number" dataKey="margin" name="Margin" tick={{ fontSize: 11 }} tickFormatter={(v) => `£${v}`} />
                  <ZAxis range={[55, 55]} />
                  <Tooltip
                    contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', fontSize: 12 }}
                    formatter={(v: any) => moneyExact(Number(v))}
                    labelFormatter={() => ''}
                  />
                  <Scatter data={sold} fill="hsl(var(--primary))" />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {vatRegistered && (
      <Card>
        <CardHeader><CardTitle>Profit by VAT scheme</CardTitle></CardHeader>
        <CardContent>
          <ReportTable
            rows={bySchemeRows}
            rowKey={(r) => r.key}
            csvName="profit-by-vat-scheme"
            initialSort="revenue"
            columns={[
              { key: 'key', label: 'Scheme', value: (r) => r.key },
              { key: 'sold', label: 'Sold', right: true, value: (r) => r.sold },
              { key: 'revenue', label: 'Revenue', right: true, value: (r) => money(r.revenue), sortValue: (r) => r.revenue },
              { key: 'cost', label: 'Cost', right: true, value: (r) => money(r.cost), sortValue: (r) => r.cost },
              { key: 'margin', label: 'Margin', right: true, value: (r) => money(r.margin), sortValue: (r) => r.margin },
              { key: 'marginPct', label: 'Margin %', right: true, value: (r) => pct(r.marginPct), sortValue: (r) => r.marginPct },
            ]}
          />
        </CardContent>
      </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Deal-by-deal</CardTitle>
          <CardDescription>Every bike sold in the period with its full cost stack.</CardDescription>
        </CardHeader>
        <CardContent>
          <ReportTable
            rows={sold}
            rowKey={(r) => r.id}
            csvName="deals"
            initialSort="saleDate"
            columns={[
              { key: 'label', label: 'Bike', value: (r) => r.label },
              { key: 'saleDate', label: 'Sold', value: (r) => (r.saleDate ? format(new Date(r.saleDate), 'd MMM yy') : '—'), sortValue: (r) => r.saleDate || '' },
              { key: 'revenue', label: 'Revenue', right: true, value: (r) => money(r.revenue), sortValue: (r) => r.revenue },
              { key: 'purchaseCost', label: 'Buy', right: true, value: (r) => money(r.purchaseCost), sortValue: (r) => r.purchaseCost },
              { key: 'prepCost', label: 'Prep', right: true, value: (r) => money(r.prepCost), sortValue: (r) => r.prepCost },
              { key: 'logisticsCost', label: 'Logistics', right: true, value: (r) => money(r.logisticsCost), sortValue: (r) => r.logisticsCost },
              { key: 'margin', label: 'Margin', right: true, value: (r) => money(r.margin), sortValue: (r) => r.margin, className: (r) => (r.margin < 0 ? 'text-destructive' : '') },
              { key: 'marginPct', label: 'Margin %', right: true, value: (r) => pct(r.marginPct), sortValue: (r) => r.marginPct },
              { key: 'daysToSell', label: 'Days', right: true, value: (r) => r.daysToSell ?? '—', sortValue: (r) => r.daysToSell ?? 0 },
            ]}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold mt-1 tabular-nums">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}
