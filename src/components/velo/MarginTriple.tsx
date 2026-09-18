import { cn } from "@/lib/utils";

const gbp = (value: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(value);

interface MarginTripleProps {
  cost?: number | null;
  asking?: number | null;
  className?: string;
  /** Mechanics never see figures — render nothing at all. */
  hidden?: boolean;
}

/** cost → asking  +33% — figures travel together, margin signed. */
export function MarginTriple({ cost, asking, className, hidden }: MarginTripleProps) {
  if (hidden) return null;

  const hasCost = typeof cost === "number" && cost > 0;
  const hasAsking = typeof asking === "number" && asking > 0;
  const margin = hasCost && hasAsking ? ((asking! - cost!) / cost!) * 100 : null;

  return (
    <span className={cn("inline-flex items-baseline gap-1.5 whitespace-nowrap tabular", className)}>
      <span className="font-medium">{hasCost ? gbp(cost!) : "£—"}</span>
      <span className="text-muted-foreground">→</span>
      <span className="font-medium">{hasAsking ? gbp(asking!) : "£—"}</span>
      {margin !== null && (
        <span className={cn("font-medium", margin >= 0 ? "text-gain" : "text-loss")}>
          {margin >= 0 ? "▲ +" : "▼ "}
          {Math.abs(Math.round(margin))}%
        </span>
      )}
    </span>
  );
}

export default MarginTriple;
