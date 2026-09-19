import { ArrowDown, ArrowUp, Minus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { pct, type Delta } from '@/lib/reports';

interface Props {
  label: string;
  value: string;
  sub?: string;
  delta?: Delta | null;
  /** When true a fall is good (e.g. days to sell). */
  invert?: boolean;
  format?: (n: number) => string;
}

export default function MetricCard({ label, value, sub, delta, invert, format }: Props) {
  const dir = delta ? (delta.abs > 0 ? 1 : delta.abs < 0 ? -1 : 0) : 0;
  const good = invert ? dir < 0 : dir > 0;
  const tone = dir === 0 ? 'text-muted-foreground' : good ? 'text-emerald-500' : 'text-destructive';
  const Icon = dir === 0 ? Minus : dir > 0 ? ArrowUp : ArrowDown;

  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground truncate">{label}</p>
        <p className="text-2xl font-semibold mt-1 tabular-nums">{value}</p>
        <div className="flex items-center gap-2 mt-1 text-xs">
          {delta && (
            <span className={`inline-flex items-center gap-1 ${tone}`}>
              <Icon className="h-3 w-3" />
              {delta.pct != null ? pct(Math.abs(delta.pct)) : format ? format(Math.abs(delta.abs)) : Math.abs(delta.abs).toFixed(0)}
            </span>
          )}
          {sub && <span className="text-muted-foreground truncate">{sub}</span>}
        </div>
      </CardContent>
    </Card>
  );
}
