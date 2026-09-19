import { cn } from "@/lib/utils";

interface StatBlockProps {
  label: string;
  value: string | number;
  delta?: string;
  deltaDirection?: "up" | "down";
  hint?: string;
  className?: string;
}

/** Label above, Bricolage figure below, signed delta beside it. Ticks once on mount. */
export function StatBlock({ label, value, delta, deltaDirection, hint, className }: StatBlockProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <p className="label-text">{label}</p>
      <div className="flex items-baseline gap-2">
        <span className="stat-figure animate-stat-tick">{value}</span>
        {delta && (
          <span
            className={cn("text-sm font-medium tabular", deltaDirection === "down" ? "text-loss" : "text-gain")}
          >
            {deltaDirection === "down" ? "▼ " : "▲ "}
            {delta}
          </span>
        )}
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export default StatBlock;
