import { useState } from 'react';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { presetRange, type Range } from '@/lib/reports';

const PRESETS: { id: string; label: string }[] = [
  { id: '7d', label: '7 days' },
  { id: '30d', label: '30 days' },
  { id: '90d', label: '90 days' },
  { id: 'ytd', label: 'YTD' },
  { id: '12m', label: '12 months' },
  { id: 'all', label: 'All time' },
];

interface Props {
  preset: string;
  range: Range;
  onChange: (preset: string, range: Range) => void;
}

export default function TimeframePicker({ preset, range, onChange }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {PRESETS.map((p) => (
        <Button
          key={p.id}
          size="sm"
          variant={preset === p.id ? 'default' : 'outline'}
          onClick={() => onChange(p.id, presetRange(p.id))}
        >
          {p.label}
        </Button>
      ))}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            size="sm"
            variant={preset === 'custom' ? 'default' : 'outline'}
            className="gap-2"
          >
            <CalendarIcon className="h-4 w-4" />
            {preset === 'custom'
              ? `${format(range.from, 'd MMM')} – ${format(range.to, 'd MMM yy')}`
              : 'Custom'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
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
    </div>
  );
}
