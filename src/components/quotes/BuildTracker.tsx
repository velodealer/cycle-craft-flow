import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Check, Plus, Trash2, Hammer, Receipt } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { QuoteRow } from "@/lib/quotes";
import {
  BUILD_STEPS, PART_STATUS_LABEL, acceptQuote, addBuildPart, deleteBuildPart, getBuild,
  listBuildParts, startBuild, syncBikeCost, updateBuildPart, updateQuoteBuild,
  type BuildPart, type BuildStatus, type PartStatus,
} from "@/lib/builds";

const gbp = (n: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n || 0);

export function BuildTracker({ quoteId, rows, salePrice, quoteName, dirty }: {
  quoteId: string; rows: QuoteRow[]; salePrice: number; quoteName: string; dirty: boolean;
}) {
  const [status, setStatus] = useState<BuildStatus>("quote");
  const [bikeId, setBikeId] = useState<string | null>(null);
  const [customer, setCustomer] = useState({ name: "", email: "" });
  const [parts, setParts] = useState<BuildPart[]>([]);
  const [busy, setBusy] = useState(false);
  const [make, setMake] = useState("");
  const [model, setModel] = useState(quoteName);

  const load = useCallback(async () => {
    try {
      const [b, p] = await Promise.all([getBuild(quoteId), listBuildParts(quoteId)]);
      setStatus(b.build_status ?? "quote");
      setBikeId(b.bike_id);
      setCustomer({ name: b.customer_name ?? "", email: b.customer_email ?? "" });
      setParts(p);
    } catch (e: any) { toast.error(e.message); }
  }, [quoteId]);
  useEffect(() => { load(); }, [load]);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try { await fn(); await load(); } catch (e: any) { toast.error(e.message ?? "Failed"); }
    finally { setBusy(false); }
  };

  const patchLocal = (id: string, patch: Partial<BuildPart>) =>
    setParts((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  const counts = {
    to_order: parts.filter((p) => p.source === "order" && p.status === "to_order").length,
    ordered: parts.filter((p) => p.status === "ordered").length,
    ready: parts.filter((p) => p.status === "received" || p.status === "fitted").length,
  };
  const allIn = parts.length > 0 && counts.ready === parts.length;
  const stepIdx = BUILD_STEPS.findIndex((s) => s.key === status);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2"><Hammer className="h-5 w-5" />Build</CardTitle>
            <CardDescription>Turn this quote into a bike, order parts and invoice the customer.</CardDescription>
          </div>
          {status === "cancelled" && <Badge variant="destructive">Not going ahead</Badge>}
        </div>
        {status !== "cancelled" && (
          <ol className="flex items-center gap-1 pt-3 text-xs">
            {BUILD_STEPS.map((s, i) => (
              <li key={s.key} className="flex items-center gap-1 flex-1">
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${i <= stepIdx ? "bg-primary text-primary-foreground border-primary" : "text-muted-foreground"}`}>
                  {i < stepIdx ? <Check className="h-3 w-3" /> : i + 1}
                </span>
                <span className={i <= stepIdx ? "font-medium" : "text-muted-foreground"}>{s.label}</span>
                {i < BUILD_STEPS.length - 1 && <span className="h-px flex-1 bg-border" />}
              </li>
            ))}
          </ol>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {status === "quote" && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><Label>Customer name</Label><Input value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} /></div>
              <div><Label>Customer email</Label><Input type="email" value={customer.email} onChange={(e) => setCustomer({ ...customer, email: e.target.value })} /></div>
            </div>
            {dirty && <p className="text-xs text-warning">Save the quote first so the parts list uses your latest changes.</p>}
            <div className="flex gap-2 flex-wrap">
              <Button disabled={busy || dirty} onClick={() => run(() => acceptQuote(quoteId, rows, customer))}>Customer accepted — go ahead</Button>
              <Button variant="outline" disabled={busy} onClick={() => run(() => updateQuoteBuild(quoteId, { build_status: "cancelled" }))}>Not going ahead</Button>
            </div>
          </div>
        )}

        {status === "cancelled" && (
          <Button variant="outline" disabled={busy} onClick={() => run(() => updateQuoteBuild(quoteId, { build_status: "quote" }))}>Reopen quote</Button>
        )}

        {(status === "accepted" || status === "building" || status === "completed") && (
          <>
            <div className="flex flex-wrap gap-2 text-sm">
              <Badge variant="outline">{counts.to_order} to order</Badge>
              <Badge variant="outline">{counts.ordered} ordered</Badge>
              <Badge variant="outline">{counts.ready}/{parts.length} in hand</Badge>
              {customer.name && <span className="text-muted-foreground">for {customer.name}</span>}
            </div>

            <div className="space-y-2">
              {parts.map((p) => (
                <div key={p.id} className="grid grid-cols-2 md:grid-cols-12 gap-2 items-center border rounded-md p-2">
                  <Input className="col-span-2 md:col-span-2" value={p.description}
                    onChange={(e) => patchLocal(p.id, { description: e.target.value })}
                    onBlur={(e) => updateBuildPart(p.id, { description: e.target.value }).catch((er) => toast.error(er.message))} />
                  <Select value={p.source} onValueChange={(v) => run(() => updateBuildPart(p.id, { source: v as any, status: v === "stock" ? "received" : "to_order" }))}>
                    <SelectTrigger className="md:col-span-2"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="order">Order new</SelectItem><SelectItem value="stock">From our stock</SelectItem></SelectContent>
                  </Select>
                  <Select value={p.status} onValueChange={(v) => run(() => updateBuildPart(p.id, { status: v as PartStatus }))}>
                    <SelectTrigger className="md:col-span-2"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(PART_STATUS_LABEL) as PartStatus[]).map((k) => <SelectItem key={k} value={k}>{PART_STATUS_LABEL[k]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Input className="md:col-span-2" placeholder="Supplier" value={p.supplier ?? ""}
                    onChange={(e) => patchLocal(p.id, { supplier: e.target.value })}
                    onBlur={(e) => updateBuildPart(p.id, { supplier: e.target.value || null }).catch((er) => toast.error(er.message))} />
                  <Input className="md:col-span-1" placeholder="Order #" value={p.order_ref ?? ""}
                    onChange={(e) => patchLocal(p.id, { order_ref: e.target.value })}
                    onBlur={(e) => updateBuildPart(p.id, { order_ref: e.target.value || null }).catch((er) => toast.error(er.message))} />
                  <div className="md:col-span-1">
                    <Input type="number" inputMode="decimal" step="0.01" min="0" aria-label="Unit price" value={p.unit_cost}
                      onChange={(e) => patchLocal(p.id, { unit_cost: Number(e.target.value) || 0 })}
                      onBlur={(e) => updateBuildPart(p.id, { unit_cost: Number(e.target.value) || 0 })
                        .then(() => syncBikeCost(quoteId)).catch((er) => toast.error(er.message))} />
                  </div>
                  <span className="md:col-span-1 text-right text-sm tabular-nums">{gbp(p.qty * p.unit_cost)}</span>
                  <Button variant="ghost" size="icon" className="justify-self-end" aria-label="Remove part" onClick={() => run(async () => { await deleteBuildPart(p.id); await syncBikeCost(quoteId); })}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
              <Button variant="outline" size="sm" disabled={busy} onClick={() => run(() => addBuildPart(quoteId, parts.length))}><Plus className="h-4 w-4 mr-1" />Add part</Button>
            </div>

            {status === "accepted" && (
              <div className="rounded-md border p-3 space-y-3">
                <p className="text-sm font-medium">Start the build — creates the bike in VeloDealer (goes straight to Repair, cost = parts total).</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div><Label>Make</Label><Input value={make} onChange={(e) => setMake(e.target.value)} placeholder="e.g. Enve" /></div>
                  <div><Label>Model</Label><Input value={model} onChange={(e) => setModel(e.target.value)} /></div>
                </div>
                <Button disabled={busy || !make.trim() || !model.trim()} onClick={() => run(async () => {
                  await startBuild(quoteId, { make: make.trim(), model: model.trim(), parts, salePrice });
                  toast.success("Bike created");
                })}>Start build</Button>
              </div>
            )}

            {bikeId && (
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" asChild><Link to={`/bikes/${bikeId}`}>Open bike</Link></Button>
                <Button variant="outline" asChild><Link to={`/bikes/${bikeId}`}><Receipt className="h-4 w-4 mr-1" />Invoice customer (Record sale on bike)</Link></Button>
                {status === "building" && (
                  <Button disabled={busy || !allIn} title={allIn ? "" : "All parts must be received first"}
                    onClick={() => run(() => updateQuoteBuild(quoteId, { build_status: "completed" }))}>Mark build complete</Button>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
