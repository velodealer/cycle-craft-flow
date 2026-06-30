import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts';
import { PIPELINE_STATUSES, money, inRange } from '@/lib/reports';
import type { ReportsData } from '@/hooks/useReportsData';
import type { Range } from '@/lib/reports';

const STATUS_LABELS: Record<string, string> = {
  pending_intake: 'Pending intake',
  intake: 'Intake',
  cleaning: 'Cleaning',
  inspection: 'Inspection',
  repair: 'Repair',
  ready: 'Ready',
  listed: 'Listed',
  sold: 'Sold',
};

interface Props { data: ReportsData; range: Range }

export default function SalesPipelineSection({ data, range }: Props) {
  const rows = useMemo(() => {
    const filtered = data.bikes.filter(
      (b) => inRange(b.created_at, range) || inRange(b.updated_at, range),
    );
    return PIPELINE_STATUSES.map((s) => {
      const bs = filtered.filter((b) => b.status === s);
      const asking = bs.reduce((sum, b) => sum + Number(b.asking_price || 0), 0);
      const cost = bs.reduce((sum, b) => sum + Number(b.purchase_price || b.purchase_cost || 0), 0);
      return {
        status: s,
        label: STATUS_LABELS[s],
        count: bs.length,
        asking,
        cost,
        margin: asking - cost,
      };
    });
  }, [data.bikes, range]);

  return (
    <Card>
      <CardHeader><CardTitle>Sales pipeline</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={60} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', fontSize: 12 }}
              />
              <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Stage</TableHead>
              <TableHead className="text-right">Bikes</TableHead>
              <TableHead className="text-right">Asking £</TableHead>
              <TableHead className="text-right">Cost £</TableHead>
              <TableHead className="text-right">Projected margin</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.status}>
                <TableCell>{r.label}</TableCell>
                <TableCell className="text-right">{r.count}</TableCell>
                <TableCell className="text-right">{money(r.asking)}</TableCell>
                <TableCell className="text-right">{money(r.cost)}</TableCell>
                <TableCell className="text-right">{money(r.margin)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
