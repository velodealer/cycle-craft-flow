import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Plus, Trash2, Calculator, Save, ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import {
  computeTotalCost,
  getQuote,
  saveQuote,
  type QuoteRow,
  type QuoteVersion,
} from "@/lib/quotes";
import { QuoteHistoryPanel } from "@/components/quotes/QuoteHistoryPanel";

const CATEGORIES = [
  "Bike", "Frame", "Fork", "Wheels", "Wheelset", "Groupset", "Shifters", "Derailleurs",
  "Crankset", "Cassette", "Chain", "Brakes", "Handlebar", "Bars", "Stem", "Seatpost",
  "Saddle", "Tyres", "Tubes", "Bar tape", "Pedals", "Accessories", "Labour", "Other",
];

const PRESET_CATEGORIES = [
  "Frame", "Seatpost", "Stem", "Handlebar", "Groupset",
  "Wheels", "Tyres", "Tubes", "Saddle", "Bar tape",
];

const newRow = (category = "Other", parentId: string | null = null): QuoteRow => ({
  id: crypto.randomUUID(),
  description: "",
  category,
  qty: 1,
  unitCost: 0,
  parentId,
});

const presetRows = (): QuoteRow[] => PRESET_CATEGORIES.map((c) => newRow(c));

const gbp = (n: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 2 })
    .format(isFinite(n) ? n : 0);

const pct = (n: number) => (isFinite(n) ? `${(n * 100).toFixed(1)}%` : "—");

export default function QuoteBuilderPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === "new";
  const nav = useNavigate();
  const { user } = useAuth();

  const [quoteId, setQuoteId] = useState<string | null>(isNew ? null : id!);
  const [currentVersion, setCurrentVersion] = useState<number>(0);
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [salePrice, setSalePrice] = useState<number>(0);
  const [rows, setRows] = useState<QuoteRow[]>(presetRows());

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [historyRefresh, setHistoryRefresh] = useState(0);

  useEffect(() => {
    if (isNew) return;
    setLoading(true);
    getQuote(id!)
      .then((q) => {
        setQuoteId(q.id);
        setCurrentVersion(q.current_version);
        setName(q.name);
        setNotes(q.notes ?? "");
        setSalePrice(Number(q.sale_price));
        const loaded = (q.rows ?? []).map((r: any) => ({
          id: r.id ?? crypto.randomUUID(),
          description: r.description ?? "",
          category: r.category ?? "Other",
          qty: Number(r.qty) || 0,
          unitCost: Number(r.unitCost) || 0,
          parentId: r.parentId ?? null,
        }));
        setRows(loaded.length ? loaded : presetRows());
        setDirty(false);
      })
      .catch((e) => toast.error(e.message ?? "Failed to load quote"))
      .finally(() => setLoading(false));
  }, [id, isNew]);

  // Warn on unload if unsaved
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const totalCost = useMemo(() => computeTotalCost(rows), [rows]);
  const profit = salePrice - totalCost;
  const margin = salePrice > 0 ? profit / salePrice : NaN;
  const markup = totalCost > 0 ? profit / totalCost : NaN;
  const roi = totalCost > 0 ? profit / totalCost : NaN;

  const markDirty = () => setDirty(true);
  const updateRow = (rid: string, patch: Partial<QuoteRow>) => {
    setRows((rs) => rs.map((r) => (r.id === rid ? { ...r, ...patch } : r)));
    markDirty();
  };
  const removeRow = (rid: string) => {
    setRows((rs) => (rs.length > 1 ? rs.filter((r) => r.id !== rid) : rs));
    markDirty();
  };
  const addRow = () => {
    setRows((rs) => [...rs, newRow()]);
    markDirty();
  };

  const handleRestore = (v: QuoteVersion) => {
    setName(v.name);
    setNotes(v.notes ?? "");
    setSalePrice(Number(v.sale_price));
    const restored = (v.rows ?? []).map((r: any) => ({
      id: r.id ?? crypto.randomUUID(),
      description: r.description ?? "",
      category: r.category ?? "Other",
      qty: Number(r.qty) || 0,
      unitCost: Number(r.unitCost) || 0,
    }));
    setRows(restored.length ? restored : [newRow()]);
    setDirty(true);
  };

  const handleSave = async () => {
    if (!user) return toast.error("Not signed in");
    if (!name.trim()) return toast.error("Give the quote a name");
    setSaving(true);
    try {
      const saved = await saveQuote({
        id: quoteId ?? undefined,
        name: name.trim(),
        notes: notes.trim() ? notes.trim() : null,
        sale_price: salePrice,
        rows,
        userId: user.id,
      });
      setQuoteId(saved.id);
      setCurrentVersion(saved.current_version);
      setDirty(false);
      setHistoryRefresh((k) => k + 1);
      toast.success(`Saved v${saved.current_version}`);
      if (isNew) nav(`/quote-builder/${saved.id}`, { replace: true });
    } catch (e: any) {
      toast.error(e.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const profitTone =
    profit > 0 ? "text-green-600" : profit < 0 ? "text-red-600" : "text-foreground";

  if (loading) {
    return (
      <div className="container mx-auto p-6 text-sm text-muted-foreground">Loading…</div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6 max-w-6xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => nav("/quote-builder")}
            className="mb-2 -ml-2"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            All quotes
          </Button>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Calculator className="h-6 w-6" />
            {isNew ? "New quote" : name || "Quote"}
            {!isNew && (
              <Badge variant="secondary" className="ml-2">
                v{currentVersion}
              </Badge>
            )}
            {dirty && (
              <Badge variant="outline" className="ml-1 text-orange-600 border-orange-300">
                Unsaved
              </Badge>
            )}
          </h1>
        </div>
        <div className="flex gap-2">
          <QuoteHistoryPanel
            quoteId={quoteId}
            currentVersion={currentVersion}
            onRestore={handleRestore}
            refreshKey={historyRefresh}
          />
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-1">
            <Label htmlFor="quote-name">Name</Label>
            <Input
              id="quote-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                markDirty();
              }}
              placeholder="e.g. Custom Enve build for J. Smith"
            />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="quote-notes">Notes</Label>
            <Textarea
              id="quote-notes"
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                markDirty();
              }}
              placeholder="Optional context — customer requirements, timeline, etc."
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Components</CardTitle>
          <CardDescription>Add each part with its cost.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="hidden md:grid grid-cols-12 gap-2 text-xs uppercase tracking-wide text-muted-foreground px-1">
            <div className="col-span-4">Description</div>
            <div className="col-span-3">Category</div>
            <div className="col-span-1 text-right">Qty</div>
            <div className="col-span-2 text-right">Unit cost</div>
            <div className="col-span-1 text-right">Total</div>
            <div className="col-span-1" />
          </div>

          {rows.map((r) => {
            const lineTotal = (r.qty || 0) * (r.unitCost || 0);
            return (
              <div
                key={r.id}
                className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center border rounded-md p-3 md:border-0 md:p-0"
              >
                <div className="md:col-span-4">
                  <Label className="md:hidden text-xs">Description</Label>
                  <Input
                    placeholder="e.g. Enve SES 5.6 Wheelset"
                    value={r.description}
                    onChange={(e) => updateRow(r.id, { description: e.target.value })}
                  />
                </div>
                <div className="md:col-span-3">
                  <Label className="md:hidden text-xs">Category</Label>
                  <Select
                    value={r.category}
                    onValueChange={(v) => updateRow(r.id, { category: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-1">
                  <Label className="md:hidden text-xs">Qty</Label>
                  <Input
                    type="number"
                    min={0}
                    step="1"
                    className="md:text-right"
                    value={r.qty}
                    onChange={(e) => updateRow(r.id, { qty: Number(e.target.value) || 0 })}
                  />
                </div>
                <div className="md:col-span-2">
                  <Label className="md:hidden text-xs">Unit cost (£)</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    className="md:text-right"
                    value={r.unitCost}
                    onChange={(e) => updateRow(r.id, { unitCost: Number(e.target.value) || 0 })}
                  />
                </div>
                <div className="md:col-span-1 md:text-right font-medium tabular-nums">
                  <span className="md:hidden text-xs text-muted-foreground mr-2">
                    Line total:
                  </span>
                  {gbp(lineTotal)}
                </div>
                <div className="md:col-span-1 flex md:justify-end">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeRow(r.id)}
                    aria-label="Remove row"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}

          <div className="flex items-center justify-between pt-2">
            <Button variant="outline" onClick={addRow}>
              <Plus className="h-4 w-4 mr-2" />
              Add component
            </Button>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">Total cost</div>
              <div className="text-xl font-bold tabular-nums">{gbp(totalCost)}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Sale price</CardTitle>
            <CardDescription>What will you sell this build for?</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label htmlFor="sale-price">Sale price (£)</Label>
              <Input
                id="sale-price"
                type="number"
                min={0}
                step="0.01"
                value={salePrice}
                onChange={(e) => {
                  setSalePrice(Number(e.target.value) || 0);
                  markDirty();
                }}
              />
            </div>
            <div className="text-sm text-muted-foreground">
              Total component cost:{" "}
              <span className="font-medium text-foreground">{gbp(totalCost)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Results</CardTitle>
            <CardDescription>Live profitability breakdown.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <Stat label="Profit" value={gbp(profit)} tone={profitTone} />
              <Stat label="Margin" value={pct(margin)} hint="profit ÷ sale" tone={profitTone} />
              <Stat label="Markup" value={pct(markup)} hint="profit ÷ cost" tone={profitTone} />
              <Stat label="ROI" value={pct(roi)} hint="return on investment" tone={profitTone} />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: string;
}) {
  return (
    <div className="rounded-lg border p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-2xl font-bold tabular-nums mt-1 ${tone ?? ""}`}>{value}</div>
      {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
    </div>
  );
}
