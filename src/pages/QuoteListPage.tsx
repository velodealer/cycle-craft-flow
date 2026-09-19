import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Calculator, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { listQuotes, deleteQuote, type Quote } from "@/lib/quotes";
import { PageHeader, Panel, EmptyState } from '@/components/velo/PageShell';

const gbp = (n: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(
    isFinite(n) ? n : 0
  );

export default function QuoteListPage() {
  const nav = useNavigate();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      setQuotes(await listQuotes());
    } catch (e: any) {
      toast.error(e.message ?? "Failed to load quotes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete quote "${name}"? This also removes its version history.`)) return;
    try {
      await deleteQuote(id);
      toast.success("Quote deleted");
      load();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to delete");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quotes"
        description="Saved build quotes with full version history."
        actions={
          <Button onClick={() => nav("/quote-builder/new")}>
            <Plus className="h-4 w-4 mr-2" />
            New quote
          </Button>
        }
      />

      <Panel title="All quotes" bodyClassName="p-0 sm:p-4">
        <div className="p-4 sm:p-0">
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : quotes.length === 0 ? (
            <EmptyState fact="No quotes yet." fix="Start one with New quote." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead className="text-right">Sale</TableHead>
                  <TableHead className="text-right">Profit</TableHead>
                  <TableHead className="text-right">Margin</TableHead>
                  <TableHead className="text-right">Ver.</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {quotes.map((q) => {
                  const profit = Number(q.sale_price) - Number(q.total_cost);
                  const margin =
                    Number(q.sale_price) > 0 ? profit / Number(q.sale_price) : NaN;
                  return (
                    <TableRow key={q.id} className="cursor-pointer">
                      <TableCell>
                        <Link
                          to={`/quote-builder/${q.id}`}
                          className="font-medium hover:underline"
                        >
                          {q.name}
                        </Link>
                        {q.notes && (
                          <div className="text-xs text-muted-foreground line-clamp-1">
                            {q.notes}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {gbp(Number(q.total_cost))}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {gbp(Number(q.sale_price))}
                      </TableCell>
                      <TableCell
                        className={`text-right tabular-nums ${
                          profit > 0
                            ? "text-gain"
                            : profit < 0
                            ? "text-loss"
                            : ""
                        }`}
                      >
                        {gbp(profit)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {isFinite(margin) ? `${(margin * 100).toFixed(1)}%` : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        v{q.current_version}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(q.updated_at).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleDelete(q.id, q.name);
                          }}
                          aria-label="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </Panel>
    </div>
  );
}
