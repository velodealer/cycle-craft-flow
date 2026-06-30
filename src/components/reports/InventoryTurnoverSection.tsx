import { useMemo } from 'react';
import { differenceInCalendarDays } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { inRange } from '@/lib/reports';
import type { ReportsData } from '@/hooks/useReportsData';
import type { Range } from '@/lib/reports';

interface Props { data: ReportsData; range: Range }

type Row = { category: string; sold: number; avgInventory: number; turnover: number; daysOnHand: number };

export default function InventoryTurnoverSection({ data, range }: Props) {
  const rows: Row[] = useMemo(() => {
    const days = Math.max(1, differenceInCalendarDays(range.to, range.from));

    // Snapshot helper: items considered "in inventory" at instant `t`.
    const bikeIsStockAt = (b: any, t: Date) => {
      const created = new Date(b.created_at).getTime();
      if (created > t.getTime()) return false;
      if (b.status === 'sold' && b.updated_at && new Date(b.updated_at).getTime() <= t.getTime()) return false;
      return true;
    };
    const partIsStockAt = (p: any, t: Date) => {
      const created = new Date(p.created_at).getTime();
      if (created > t.getTime()) return false;
      if (p.bike_id) return false;
      if (p.stock_status === 'sold' && p.updated_at && new Date(p.updated_at).getTime() <= t.getTime()) return false;
      return true;
    };

    const bikeStart = data.bikes.filter((b) => bikeIsStockAt(b, range.from)).length;
    const bikeEnd = data.bikes.filter((b) => bikeIsStockAt(b, range.to)).length;
    const bikeSold = data.bikes.filter((b) => b.status === 'sold' && inRange(b.updated_at, range)).length;
    const bikeAvg = (bikeStart + bikeEnd) / 2;
    const bikeTurn = bikeAvg > 0 ? bikeSold / bikeAvg : 0;

    const out: Row[] = [{
      category: 'Bikes',
      sold: bikeSold,
      avgInventory: bikeAvg,
      turnover: bikeTurn,
      daysOnHand: bikeTurn > 0 ? days / bikeTurn : Infinity,
    }];

    const types = Array.from(new Set(data.parts.map((p) => p.type).filter(Boolean)));
    for (const t of types) {
      const ofType = data.parts.filter((p) => p.type === t);
      const start = ofType.filter((p) => partIsStockAt(p, range.from)).reduce((s, p) => s + Number(p.quantity || 1), 0);
      const end = ofType.filter((p) => partIsStockAt(p, range.to)).reduce((s, p) => s + Number(p.quantity || 1), 0);
      const sold = ofType.filter((p) => p.stock_status === 'sold' && inRange(p.updated_at, range)).reduce((s, p) => s + Number(p.quantity || 1), 0);
      const avg = (start + end) / 2;
      const turn = avg > 0 ? sold / avg : 0;
      out.push({
        category: `Parts — ${t}`,
        sold,
        avgInventory: avg,
        turnover: turn,
        daysOnHand: turn > 0 ? days / turn : Infinity,
      });
    }
    return out;
  }, [data, range]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Inventory turnover</CardTitle>
        <CardDescription>Units sold ÷ average inventory across the selected period.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Sold</TableHead>
              <TableHead className="text-right">Avg inventory</TableHead>
              <TableHead className="text-right">Turnover</TableHead>
              <TableHead className="text-right">Days on hand</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.category}>
                <TableCell>{r.category}</TableCell>
                <TableCell className="text-right">{r.sold}</TableCell>
                <TableCell className="text-right">{r.avgInventory.toFixed(1)}</TableCell>
                <TableCell className="text-right">{r.turnover.toFixed(2)}×</TableCell>
                <TableCell className="text-right">{Number.isFinite(r.daysOnHand) ? Math.round(r.daysOnHand) : '∞'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
