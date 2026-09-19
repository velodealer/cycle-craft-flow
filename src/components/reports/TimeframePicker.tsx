import { useState } from 'react';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { PERIOD_PRESETS, presetRange, type CompareMode, type Range } from '@/lib/reports';

interface Props {
  preset: string;
  range: Range;
  compare: CompareMode;
  onChange: (preset: string, range: Range) => void;
  onCompareChange: (mode: CompareMode) => void;
}

export default function TimeframePicker({ preset, range, compare, onChange, onCompareChange }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={preset === 'custom' ? 'custom' : preset} onValueChange={(v) => onChange(v, presetRange(v))}>
        <SelectTrigger className="h-8 w-[170px] text-xs">
          <SelectValue placeholder="Period" />
        </SelectTrigger>
        <SelectContent className="bg-popover z-50">
          {PERIOD_PRESETS.map((p) => (
            <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
          ))}
          {preset === 'custom' && <SelectItem value="custom">Custom</SelectItem>}
        </SelectContent>
      </Select>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button size="sm" variant={preset === 'custom' ? 'default' : 'outline'} className="h-8 gap-2 text-xs">
            <CalendarIcon className="h-3.5 w-3.5" />
            {preset === 'custom' ? `${format(range.from, 'd MMM')} – ${format(range.to, 'd MMM yy')}` : 'Custom'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 bg-popover z-50" align="end">
          <Calendar
            mode="range"
            selected={{ from: range.from, to: range.to }}
            onSelect={(r) => {
              if (r?.from && r?.to) {
                onChange('custom', { from: r.from, to: r.to });
                setOpen(false);
              }
            }}
            numberOfMonths={2}
            initialFocus
            className={cn('p-3 pointer-events-auto')}
          />
        </PopoverContent>
      </Popover>

      <Select value={compare} onValueChange={(v) => onCompareChange(v as CompareMode)}>
        <SelectTrigger className="h-8 w-[180px] text-xs">
          <SelectValue placeholder="Compare" />
        </SelectTrigger>
        <SelectContent className="bg-popover z-50">
          <SelectItem value="none">No comparison</SelectItem>
          <SelectItem value="prev">vs previous period</SelectItem>
          <SelectItem value="yoy">vs same period last year</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
