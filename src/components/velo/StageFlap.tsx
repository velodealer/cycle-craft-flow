import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export const STAGE_LABELS: Record<string, string> = {
  pending_intake: "Pending intake",
  intake: "Intake",
  cleaning: "Cleaning",
  inspection: "Inspection",
  pending_approval: "Owner approval",
  repair: "Repair",
  ready: "Ready",
  listed: "Listed",
  sold: "Sold",
  awaiting_collection: "Awaiting collection",
  collection_in_progress: "Collection in progress",
  in_transit: "In transit",
  collected: "Collected",
  delivered: "Delivered",
  in_stock: "In stock",
  broken: "Broken",
};

/** Stages that mean money or permission is pending — the only amber flaps. */
const WARNING_STAGES = new Set(["pending_approval", "awaiting_collection"]);

export function stageLabel(stage?: string | null) {
  if (!stage) return "—";
  return STAGE_LABELS[stage] ?? stage.replace(/_/g, " ");
}

interface StageFlapProps {
  stage?: string | null;
  className?: string;
  size?: "sm" | "md";
}

/**
 * The signature split-flap stage block. Flips once when the stage changes.
 */
export function StageFlap({ stage, className, size = "md" }: StageFlapProps) {
  const [flipping, setFlipping] = useState(false);
  const previous = useRef(stage);

  useEffect(() => {
    if (previous.current !== undefined && previous.current !== stage) {
      const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      if (!reduced) {
        setFlipping(true);
        const timer = window.setTimeout(() => setFlipping(false), 300);
        return () => window.clearTimeout(timer);
      }
    }
    previous.current = stage;
  }, [stage]);

  const warning = stage ? WARNING_STAGES.has(stage) : false;

  return (
    <span
      data-stage={stage ?? "unknown"}
      className={cn(
        "inline-flex select-none items-center rounded-[2px] border border-border uppercase",
        "label-text font-medium",
        size === "md" ? "px-2 py-1 text-[11px]" : "px-1.5 py-0.5 text-[10px]",
        warning ? "bg-warning/15 text-warning" : "bg-secondary text-foreground",
        flipping && "animate-flap-flip",
        className,
      )}
      style={{ letterSpacing: "0.08em" }}
    >
      {stageLabel(stage)}
    </span>
  );
}

export default StageFlap;
