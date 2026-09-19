import { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { downloadCsv } from '@/lib/reports';

export interface Column<T> {
  key: string;
  label: string;
  right?: boolean;
  value: (row: T) => string | number;
  sortValue?: (row: T) => number | string;
  className?: (row: T) => string;
}

interface Props<T> {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  initialSort?: string;
  csvName?: string;
  empty?: string;
  max?: number;
  onRowClick?: (row: T) => void;
}

export default function ReportTable<T>({
  rows, columns, rowKey, initialSort, csvName, empty = 'Nothing to show for this period yet.', max = 100, onRowClick,
}: Props<T>) {
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 }>({ key: initialSort || columns[0].key, dir: -1 });

  const sorted = useMemo(() => {
    const col = columns.find((c) => c.key === sort.key);
    if (!col) return rows;
    const get = (r: T) => (col.sortValue ? col.sortValue(r) : col.value(r));
    return [...rows].sort((a, b) => {
      const av = get(a); const bv = get(b);
      if (av === bv) return 0;
      return (av < bv ? -1 : 1) * sort.dir;
    });
  }, [rows, columns, sort]);

  const exportCsv = () =>
    downloadCsv(
      csvName || 'report',
      columns.map((c) => c.label),
      sorted.map((r) => columns.map((c) => c.value(r))),
    );

  return (
    <div className="space-y-2">
      {csvName && rows.length > 0 && (
        <div className="flex justify-end">
          <Button size="sm" variant="outline" className="gap-2" onClick={exportCsv}>
            <Download className="h-3.5 w-3.5" /> CSV
          </Button>
        </div>
      )}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((c) => (
                <TableHead
                  key={c.key}
                  className={`cursor-pointer select-none whitespace-nowrap ${c.right ? 'text-right' : ''}`}
                  onClick={() => setSort((s) => (s.key === c.key ? { key: c.key, dir: (s.dir * -1) as 1 | -1 } : { key: c.key, dir: -1 }))}
                >
                  {c.label}{sort.key === c.key ? (sort.dir === -1 ? ' ↓' : ' ↑') : ''}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.length === 0 && (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-center text-muted-foreground py-6">{empty}</TableCell>
              </TableRow>
            )}
            {sorted.slice(0, max).map((r) => (
              <TableRow
                key={rowKey(r)}
                onClick={onRowClick ? () => onRowClick(r) : undefined}
                className={onRowClick ? 'cursor-pointer' : ''}
              >
                {columns.map((c) => (
                  <TableCell key={c.key} className={`${c.right ? 'text-right tabular-nums' : ''} ${c.className?.(r) || ''}`}>
                    {c.value(r)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
