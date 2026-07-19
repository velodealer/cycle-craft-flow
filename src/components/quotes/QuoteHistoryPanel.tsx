import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { History, RotateCcw } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { listQuoteVersions, type QuoteVersion } from "@/lib/quotes";
import { toast } from "sonner";

const gbp = (n: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(
    isFinite(n) ? n : 0
  );

type Props = {
  quoteId: string | null;
  currentVersion: number;
  onRestore: (v: QuoteVersion) => void;
  refreshKey: number;
};

export function QuoteHistoryPanel({
  quoteId,
  currentVersion,
  onRestore,
  refreshKey,
}: Props) {
  const [open, setOpen] = useState(false);
  const [versions, setVersions] = useState<QuoteVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !quoteId) return;
    setLoading(true);
    listQuoteVersions(quoteId)
      .then(setVersions)
      .catch((e) => toast.error(e.message ?? "Failed to load history"))
      .finally(() => setLoading(false));
  }, [open, quoteId, refreshKey]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" disabled={!quoteId}>
          <History className="h-4 w-4 mr-2" />
          History
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Version history</SheetTitle>
          <SheetDescription>
            Every save is recorded. Restoring loads a version into the editor —
            you still need to Save to commit a new version.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-2">
          {loading && (
            <div className="text-sm text-muted-foreground">Loading…</div>
          )}
          {!loading && versions.length === 0 && (
            <div className="text-sm text-muted-foreground">No versions yet.</div>
          )}
          {versions.map((v) => {
            const isCurrent = v.version === currentVersion;
            const isOpen = expanded === v.id;
            const profit = Number(v.sale_price) - Number(v.total_cost);
            return (
              <div key={v.id} className="border rounded-md">
                <button
                  className="w-full flex items-center justify-between p-3 text-left hover:bg-muted/50"
                  onClick={() => setExpanded(isOpen ? null : v.id)}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">v{v.version}</span>
                      {isCurrent && (
                        <Badge variant="secondary" className="text-xs">
                          current
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {formatDistanceToNow(new Date(v.saved_at), {
                        addSuffix: true,
                      })}
                    </div>
                  </div>
                  <div className="text-right text-xs">
                    <div className="tabular-nums">
                      {gbp(Number(v.total_cost))} → {gbp(Number(v.sale_price))}
                    </div>
                    <div
                      className={`tabular-nums ${
                        profit > 0
                          ? "text-green-600"
                          : profit < 0
                          ? "text-red-600"
                          : "text-muted-foreground"
                      }`}
                    >
                      {gbp(profit)}
                    </div>
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t p-3 space-y-3 bg-muted/30">
                    <div>
                      <div className="text-xs uppercase text-muted-foreground">
                        Name
                      </div>
                      <div className="text-sm">{v.name}</div>
                    </div>
                    {v.notes && (
                      <div>
                        <div className="text-xs uppercase text-muted-foreground">
                          Notes
                        </div>
                        <div className="text-sm whitespace-pre-wrap">
                          {v.notes}
                        </div>
                      </div>
                    )}
                    <div>
                      <div className="text-xs uppercase text-muted-foreground mb-1">
                        Components ({v.rows.length})
                      </div>
                      <div className="text-xs space-y-1 max-h-48 overflow-y-auto">
                        {v.rows.map((r, i) => (
                          <div key={i} className="flex justify-between gap-2">
                            <span className="truncate">
                              {r.description || "—"}{" "}
                              <span className="text-muted-foreground">
                                ({r.category})
                              </span>
                            </span>
                            <span className="tabular-nums whitespace-nowrap">
                              {r.qty} × {gbp(Number(r.unitCost))}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        onRestore(v);
                        setOpen(false);
                        toast.success(
                          `Loaded v${v.version} into editor — Save to commit`
                        );
                      }}
                      disabled={isCurrent}
                    >
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Restore this version
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
