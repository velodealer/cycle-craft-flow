import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Plus, Trash2, Calculator, Save, ArrowLeft, Minus } from "lucide-react";
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
  computeVat,
  getQuote,
  lineVat,
  saveQuote,
  type QuoteRow,
  type QuoteVersion,
  type VatScheme,
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
  const [vatScheme, setVatScheme] = useState<VatScheme>("standard");

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
        setVatScheme(((q as any).vat_scheme as VatScheme) ?? "standard");
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
  const vat = useMemo(
    () => computeVat(rows, salePrice, vatScheme),
    [rows, salePrice, vatScheme]
  );
  const profit = salePrice - totalCost;
  const profitAfterVat = profit - vat.marginVat;
  const margin = salePrice > 0 ? profit / salePrice : NaN;
  const markup = totalCost > 0 ? profit / totalCost : NaN;
  const roi = totalCost > 0 ? profit / totalCost : NaN;

  const markDirty = () => setDirty(true);
  const updateRow = (rid: string, patch: Partial<QuoteRow>) => {
    setRows((rs) => rs.map((r) => (r.id === rid ? { ...r, ...patch } : r)));
    markDirty();
  };
  const removeRow = (rid: string) => {
    setRows((rs) => {
      const filtered = rs.filter((r) => r.id !== rid && r.parentId !== rid);
      return filtered.length ? filtered : [newRow()];
    });
    markDirty();
  };
  const addRow = () => {
    setRows((rs) => [...rs, newRow()]);
    markDirty();
  };
  const addChildRow = (parentId: string) => {
    setRows((rs) => {
      const idx = rs.findIndex((r) => r.id === parentId);
      if (idx < 0) return rs;
      // insert after parent and any existing children of that parent
      let insertAt = idx + 1;
      while (insertAt < rs.length && rs[insertAt].parentId === parentId) insertAt++;
      const child = newRow("Wheels", parentId);
      return [...rs.slice(0, insertAt), child, ...rs.slice(insertAt)];
    });
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
      parentId: r.parentId ?? null,
    }));
    setRows(restored.length ? restored : [newRow()]);
    setVatScheme(((v as any).vat_scheme as VatScheme) ?? "standard");
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
        vat_scheme: vatScheme,
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
          <div className="md:col-span-3">
            <Label htmlFor="vat-scheme">VAT scheme</Label>
            <Select
              value={vatScheme}
              onValueChange={(v) => {
                setVatScheme(v as VatScheme);
                markDirty();
              }}
            >
              <SelectTrigger id="vat-scheme">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="standard">Standard VAT (20% per line)</SelectItem>
                <SelectItem value="margin">Margin scheme (1/6 of profit)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              {vatScheme === "standard"
                ? "20% VAT is added on top of each component's cost."
                : "No VAT on individual parts. VAT is 1/6 of (sale − cost)."}
            </p>
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
            <div className="col-span-3">Description</div>
            <div className="col-span-3">Category</div>
            <div className="col-span-1 text-right">Qty</div>
            <div className="col-span-2 text-right">Unit cost</div>
            <div className="col-span-1 text-right">VAT</div>
            <div className="col-span-1 text-right">Total</div>
            <div className="col-span-1" />
          </div>

          {rows.map((r) => {
            const lineTotal = (r.qty || 0) * (r.unitCost || 0);
            const isChild = !!r.parentId;
            const parent = isChild ? rows.find((p) => p.id === r.parentId) : null;
            const rowVat = Math.abs(lineVat(r, vatScheme));
            return (
              <div
                key={r.id}
                className={`grid grid-cols-1 md:grid-cols-12 gap-2 items-center border rounded-md p-3 md:border-0 md:p-0 ${
                  isChild ? "md:pl-8 border-l-2 border-l-destructive/40 bg-destructive/5 md:bg-transparent" : ""
                }`}
              >
                <div className="md:col-span-3">
                  <Label className="md:hidden text-xs">Description</Label>
                  <div className="flex items-center gap-2">
                    {isChild && <Minus className="h-4 w-4 text-destructive shrink-0" />}
                    <Input
                      placeholder={
                        isChild
                          ? `Part removed from ${parent?.description || "bike"}`
                          : "e.g. Enve SES 5.6 Wheelset"
                      }
                      value={r.description}
                      onChange={(e) => updateRow(r.id, { description: e.target.value })}
                    />
                  </div>
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
                <div
                  className={`md:col-span-1 md:text-right tabular-nums text-sm ${
                    vatScheme === "margin"
                      ? "text-muted-foreground"
                      : isChild
                      ? "text-destructive"
                      : ""
                  }`}
                >
                  <span className="md:hidden text-xs text-muted-foreground mr-2">
                    VAT:
                  </span>
                  {vatScheme === "margin"
                    ? gbp(0)
                    : isChild
                    ? `− ${gbp(rowVat)}`
                    : gbp(rowVat)}
                </div>
                <div
                  className={`md:col-span-1 md:text-right font-medium tabular-nums ${
                    isChild ? "text-destructive" : ""
                  }`}
                >
                  <span className="md:hidden text-xs text-muted-foreground mr-2">
                    Line total:
                  </span>
                  {isChild ? `− ${gbp(lineTotal)}` : gbp(lineTotal)}
                </div>
                <div className="md:col-span-1 flex md:justify-end gap-1">
                  {!isChild && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => addChildRow(r.id)}
                      aria-label="Deduct part from this row"
                      title="Deduct part from this row"
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                  )}
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

          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pt-2">
            <Button variant="outline" onClick={addRow}>
              <Plus className="h-4 w-4 mr-2" />
              Add component
            </Button>
            <div className="text-right space-y-0.5 min-w-[220px]">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Net cost</span>
                <span className="tabular-nums font-medium">{gbp(totalCost)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  VAT on parts{vatScheme === "margin" ? " (margin scheme)" : ""}
                </span>
                <span className="tabular-nums font-medium">
                  {gbp(vat.lineVatTotal)}
                </span>
              </div>
              <div className="flex justify-between pt-1 border-t">
                <span className="text-xs uppercase tracking-wide text-muted-foreground">
                  Gross cost
                </span>
                <span className="tabular-nums text-xl font-bold">
                  {gbp(totalCost + vat.lineVatTotal)}
                </span>
              </div>
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
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Stat label="Profit" value={gbp(profit)} tone={profitTone} />
              <Stat label="Margin" value={pct(margin)} hint="profit ÷ sale" tone={profitTone} />
              <Stat label="Markup" value={pct(markup)} hint="profit ÷ cost" tone={profitTone} />
              <Stat label="ROI" value={pct(roi)} hint="return on investment" tone={profitTone} />
            </div>
            <div className="rounded-lg border p-4 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {vatScheme === "standard"
                    ? "VAT on parts (20%)"
                    : "VAT on margin (1/6 of profit)"}
                </span>
                <span className="tabular-nums font-medium">
                  {gbp(vatScheme === "standard" ? vat.lineVatTotal : vat.marginVat)}
                </span>
              </div>
              {vatScheme === "margin" && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Profit after VAT</span>
                  <span className={`tabular-nums font-medium ${profitTone}`}>
                    {gbp(profitAfterVat)}
                  </span>
                </div>
              )}
              <div className="flex justify-between pt-1 border-t">
                <span className="text-xs uppercase tracking-wide text-muted-foreground">
                  Total VAT
                </span>
                <span className="tabular-nums font-semibold">{gbp(vat.totalVat)}</span>
              </div>
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
