import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PRICE_BANDS } from '@/lib/reports';
import type { BikeRow, ReportFilterState } from '@/lib/reportMetrics';
import { EMPTY_FILTERS } from '@/lib/reportMetrics';

interface Props {
  rows: BikeRow[];
  value: ReportFilterState;
  onChange: (v: ReportFilterState) => void;
}

const uniq = (rows: BikeRow[], f: (r: BikeRow) => string) =>
  Array.from(new Set(rows.map(f).filter(Boolean))).sort();

export default function ReportFilters({ rows, value, onChange }: Props) {
  const set = (patch: Partial<ReportFilterState>) => onChange({ ...value, ...patch });
  const dirty = JSON.stringify(value) !== JSON.stringify(EMPTY_FILTERS);

  const groups: { key: keyof ReportFilterState; label: string; options: string[] }[] = [
    { key: 'brand', label: 'All brands', options: uniq(rows, (r) => r.brand) },
    { key: 'bikeType', label: 'All types', options: uniq(rows, (r) => r.bikeType) },
    { key: 'size', label: 'All sizes', options: uniq(rows, (r) => r.size) },
    { key: 'source', label: 'All sources', options: uniq(rows, (r) => r.source) },
    { key: 'band', label: 'All price bands', options: PRICE_BANDS.map((b) => b.label) },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      {groups.map((g) => (
        <Select key={g.key} value={value[g.key]} onValueChange={(v) => set({ [g.key]: v } as any)}>
          <SelectTrigger className="h-8 w-[150px] text-xs">
            <SelectValue placeholder={g.label} />
          </SelectTrigger>
          <SelectContent className="bg-popover z-50 max-h-72">
            <SelectItem value="all">{g.label}</SelectItem>
            {g.options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
          </SelectContent>
        </Select>
      ))}
      {dirty && (
        <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => onChange(EMPTY_FILTERS)}>
          Clear filters
        </Button>
      )}
    </div>
  );
}
