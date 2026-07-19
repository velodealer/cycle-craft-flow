import { useMemo, useState } from "react";
import { Plus, Trash2, RotateCcw, Calculator } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Row = {
  id: string;
  description: string;
  category: string;
  qty: number;
  unitCost: number;
};

const CATEGORIES = [
  "Frame",
  "Fork",
  "Wheelset",
  "Groupset",
  "Shifters",
  "Derailleurs",
  "Crankset",
  "Cassette",
  "Chain",
  "Brakes",
  "Bars",
  "Stem",
  "Seatpost",
  "Saddle",
  "Tyres",
  "Pedals",
  "Accessories",
  "Labour",
  "Other",
];

const newRow = (): Row => ({
  id: crypto.randomUUID(),
  description: "",
  category: "Other",
  qty: 1,
  unitCost: 0,
});

const gbp = (n: number) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 2,
  }).format(isFinite(n) ? n : 0);

const pct = (n: number) =>
  isFinite(n) ? `${(n * 100).toFixed(1)}%` : "—";

export default function QuoteBuilderPage() {
  const [rows, setRows] = useState<Row[]>([newRow(), newRow(), newRow()]);
  const [salePrice, setSalePrice] = useState<number>(0);

  const totalCost = useMemo(
    () => rows.reduce((sum, r) => sum + (r.qty || 0) * (r.unitCost || 0), 0),
    [rows]
  );

  const profit = salePrice - totalCost;
  const margin = salePrice > 0 ? profit / salePrice : NaN;
  const markup = totalCost > 0 ? profit / totalCost : NaN;
  const roi = totalCost > 0 ? profit / totalCost : NaN;

  const updateRow = (id: string, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const removeRow = (id: string) =>
    setRows((rs) => (rs.length > 1 ? rs.filter((r) => r.id !== id) : rs));
  const addRow = () => setRows((rs) => [...rs, newRow()]);
  const reset = () => {
    setRows([newRow(), newRow(), newRow()]);
    setSalePrice(0);
  };

  const profitTone =
    profit > 0 ? "text-green-600" : profit < 0 ? "text-red-600" : "text-foreground";

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6 max-w-6xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Calculator className="h-6 w-6" />
            New Bike Builder Quote
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            List every component cost, then enter a sale price to see profit,
            margin, markup and ROI.
          </p>
        </div>
        <Button variant="outline" onClick={reset}>
          <RotateCcw className="h-4 w-4 mr-2" />
          Reset
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Components</CardTitle>
          <CardDescription>Add each part with its cost.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Desktop header */}
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
                    onChange={(e) =>
                      updateRow(r.id, { description: e.target.value })
                    }
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
                    onChange={(e) =>
                      updateRow(r.id, { qty: Number(e.target.value) || 0 })
                    }
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
                    onChange={(e) =>
                      updateRow(r.id, {
                        unitCost: Number(e.target.value) || 0,
                      })
                    }
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
              <div className="text-xl font-bold tabular-nums">
                {gbp(totalCost)}
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
                onChange={(e) => setSalePrice(Number(e.target.value) || 0)}
              />
            </div>
            <div className="text-sm text-muted-foreground">
              Total component cost:{" "}
              <span className="font-medium text-foreground">
                {gbp(totalCost)}
              </span>
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
              <Stat
                label="Margin"
                value={pct(margin)}
                hint="profit ÷ sale"
                tone={profitTone}
              />
              <Stat
                label="Markup"
                value={pct(markup)}
                hint="profit ÷ cost"
                tone={profitTone}
              />
              <Stat
                label="ROI"
                value={pct(roi)}
                hint="return on investment"
                tone={profitTone}
              />
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
      <div className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className={`text-2xl font-bold tabular-nums mt-1 ${tone ?? ""}`}>
        {value}
      </div>
      {hint && (
        <div className="text-xs text-muted-foreground mt-1">{hint}</div>
      )}
    </div>
  );
}
