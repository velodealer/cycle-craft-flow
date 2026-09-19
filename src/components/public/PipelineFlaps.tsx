import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { stageLabel } from "@/components/velo/StageFlap";

const STAGES = ["intake", "cleaning", "inspection", "repair", "listed", "sold"];

/** The pipeline as a row of stage flaps; one flips on a slow loop. Marketing only. */
export function PipelineFlaps({ className }: { className?: string }) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => setActive((i) => (i + 1) % STAGES.length), 2200);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className={cn("flex items-center gap-2 overflow-x-auto pb-2", className)}>
      {STAGES.map((stage, i) => (
        <div key={stage} className="flex shrink-0 items-center gap-2">
          <span
            data-stage={stage}
            style={{ letterSpacing: "0.08em" }}
            className={cn(
              "label-text inline-flex select-none items-center rounded-[2px] border px-3 py-2 text-[11px] font-medium uppercase transition-colors",
              i === active
                ? "animate-flap-flip border-primary/60 bg-primary/15 text-primary"
                : "border-border bg-secondary text-muted-foreground",
            )}
          >
            {stageLabel(stage)}
          </span>
          {i < STAGES.length - 1 && <span className="text-muted-foreground">→</span>}
        </div>
      ))}
    </div>
  );
}

export default PipelineFlaps;
