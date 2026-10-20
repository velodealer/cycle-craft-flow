import { supabase } from "@/integrations/supabase/client";
import type { QuoteRow } from "@/lib/quotes";

export type BuildStatus = "quote" | "accepted" | "building" | "completed" | "cancelled";
export type PartStatus = "to_order" | "ordered" | "received" | "fitted";

export const BUILD_STEPS: { key: BuildStatus; label: string }[] = [
  { key: "quote", label: "Quote" },
  { key: "accepted", label: "Accepted" },
  { key: "building", label: "Building" },
  { key: "completed", label: "Completed" },
];

export const PART_STATUS_LABEL: Record<PartStatus, string> = {
  to_order: "To order",
  ordered: "Ordered",
  received: "Received",
  fitted: "Fitted",
};

export type BuildPart = {
  id: string;
  quote_id: string;
  description: string;
  category: string;
  qty: number;
  unit_cost: number;
  source: "order" | "stock";
  status: PartStatus;
  supplier: string | null;
  order_ref: string | null;
  ordered_at: string | null;
  received_at: string | null;
  sort_order: number;
};

const db = supabase as any;

export async function getBuild(quoteId: string) {
  const { data, error } = await db
    .from("quotes")
    .select("build_status, bike_id, customer_name, customer_email, accepted_at")
    .eq("id", quoteId)
    .single();
  if (error) throw error;
  return data as {
    build_status: BuildStatus;
    bike_id: string | null;
    customer_name: string | null;
    customer_email: string | null;
    accepted_at: string | null;
  };
}

export async function listBuildParts(quoteId: string): Promise<BuildPart[]> {
  const { data, error } = await db
    .from("build_parts")
    .select("*")
    .eq("quote_id", quoteId)
    .order("sort_order");
  if (error) throw error;
  return data ?? [];
}

export async function updateQuoteBuild(quoteId: string, patch: Record<string, unknown>) {
  const { error } = await db.from("quotes").update(patch).eq("id", quoteId);
  if (error) throw error;
}

/** Accept a quote: copies its parts (excluding deducted rows) into the order list. */
export async function acceptQuote(quoteId: string, rows: QuoteRow[], customer: { name: string; email: string }) {
  const existing = await listBuildParts(quoteId);
  if (!existing.length) {
    const parts = rows
      .filter((r) => !r.parentId && (r.description.trim() || r.unitCost > 0))
      .map((r, i) => ({
        quote_id: quoteId,
        description: r.description.trim() || r.category,
        category: r.category,
        qty: r.qty || 1,
        unit_cost: r.unitCost || 0,
        sort_order: i,
      }));
    if (parts.length) {
      const { error } = await db.from("build_parts").insert(parts);
      if (error) throw error;
    }
  }
  await updateQuoteBuild(quoteId, {
    build_status: "accepted",
    accepted_at: new Date().toISOString(),
    customer_name: customer.name || null,
    customer_email: customer.email || null,
  });
}

export async function updateBuildPart(id: string, patch: Partial<BuildPart>) {
  const p: Record<string, unknown> = { ...patch };
  if (patch.status === "ordered") p.ordered_at = new Date().toISOString();
  if (patch.status === "received") p.received_at = new Date().toISOString();
  if (patch.status === "to_order") { p.ordered_at = null; p.received_at = null; }
  const { error } = await db.from("build_parts").update(p).eq("id", id);
  if (error) throw error;
}

/** Keeps the linked bike's purchase price equal to the current build parts total. */
export async function syncBikeCost(quoteId: string) {
  const { data: q } = await db.from("quotes").select("bike_id").eq("id", quoteId).single();
  if (!q?.bike_id) return;
  const parts = await listBuildParts(quoteId);
  const cost = parts.reduce((s: number, p: BuildPart) => s + Number(p.qty) * Number(p.unit_cost), 0);
  const { error } = await db.from("bikes").update({ purchase_price: Number(cost.toFixed(2)) }).eq("id", q.bike_id);
  if (error) throw error;
}

export async function addBuildPart(quoteId: string, sort: number) {
  const { error } = await db.from("build_parts").insert({ quote_id: quoteId, description: "New part", sort_order: sort });
  if (error) throw error;
}

export async function deleteBuildPart(id: string) {
  const { error } = await db.from("build_parts").delete().eq("id", id);
  if (error) throw error;
}

/** Creates the bike record for the build and links it to the quote. Purchase price = total parts cost. */
export async function startBuild(quoteId: string, input: { make: string; model: string; parts: BuildPart[]; salePrice: number }) {
  const cost = input.parts.reduce((s, p) => s + Number(p.qty) * Number(p.unit_cost), 0);
  const { data, error } = await db
    .from("bikes")
    .insert({
      make: input.make,
      model: input.model,
      status: "repair",
      purchase_price: cost,
      asking_price: input.salePrice || null,
    })
    .select("id")
    .single();
  if (error) throw error;
  await updateQuoteBuild(quoteId, { bike_id: data.id, build_status: "building" });
  return data.id as string;
}
