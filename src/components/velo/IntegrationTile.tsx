import { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type IntegrationState = "connected" | "attention" | "error" | "off";

const STATE_LABEL: Record<IntegrationState, string> = {
  connected: "Connected",
  attention: "Needs attention",
  error: "Error",
  off: "Not connected",
};

const STATE_VARIANT: Record<IntegrationState, "success" | "warning" | "destructive" | "outline"> = {
  connected: "success",
  attention: "warning",
  error: "destructive",
  off: "outline",
};

interface IntegrationTileProps {
  name: string;
  state: IntegrationState;
  stateLabel?: string;
  detail?: string;
  lastError?: string | null;
  action?: ReactNode;
  className?: string;
}

/** Shared unit for Settings → Integrations and the dashboard's system health row. */
export function IntegrationTile({
  name,
  state,
  stateLabel,
  detail,
  lastError,
  action,
  className,
}: IntegrationTileProps) {
  return (
    <div className={cn("flex items-start justify-between gap-3 rounded-md border border-border bg-card p-3", className)}>
      <div className="min-w-0 space-y-1">
        <p className="text-sm font-medium">{name}</p>
        <Badge variant={STATE_VARIANT[state]}>{stateLabel ?? STATE_LABEL[state]}</Badge>
        {detail && <p className="truncate text-xs text-muted-foreground">{detail}</p>}
        {lastError && <p className="truncate text-xs text-loss">{lastError}</p>}
      </div>
      {action}
    </div>
  );
}

export default IntegrationTile;
