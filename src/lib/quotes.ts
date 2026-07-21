import { supabase } from "@/integrations/supabase/client";

export type VatScheme = "standard" | "margin";

export const VAT_RATE = 0.2;

export type QuoteRow = {
  id: string;
  description: string;
  category: string;
  qty: number;
  unitCost: number;
  parentId?: string | null;
};

export type Quote = {
  id: string;
  name: string;
  notes: string | null;
  sale_price: number;
  rows: QuoteRow[];
  total_cost: number;
  current_version: number;
  vat_scheme: VatScheme;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type QuoteVersion = {
  id: string;
  quote_id: string;
  version: number;
  name: string;
  notes: string | null;
  sale_price: number;
  rows: QuoteRow[];
  total_cost: number;
  vat_scheme: VatScheme;
  saved_by: string | null;
  saved_at: string;
};

export const computeTotalCost = (rows: QuoteRow[]) =>
  rows.reduce((s, r) => {
    const line = (Number(r.qty) || 0) * (Number(r.unitCost) || 0);
    return r.parentId ? s - line : s + line;
  }, 0);

/** Signed line total; child rows are negative. */
export const lineNet = (r: QuoteRow) => {
  const raw = (Number(r.qty) || 0) * (Number(r.unitCost) || 0);
  return r.parentId ? -raw : raw;
};

/** VAT on a single line for the given scheme. Child rows produce negative VAT under standard. */
export const lineVat = (r: QuoteRow, scheme: VatScheme) =>
  scheme === "standard" ? lineNet(r) * VAT_RATE : 0;

export const computeVat = (
  rows: QuoteRow[],
  salePrice: number,
  scheme: VatScheme
) => {
  const totalCost = computeTotalCost(rows);
  const lineVatTotal =
    scheme === "standard" ? rows.reduce((s, r) => s + lineVat(r, scheme), 0) : 0;
  const profit = (Number(salePrice) || 0) - totalCost;
  const marginVat = scheme === "margin" && profit > 0 ? profit / 6 : 0;
  return {
    lineVatTotal,
    marginVat,
    totalVat: lineVatTotal + marginVat,
  };
};

export async function listQuotes(): Promise<Quote[]> {
  const { data, error } = await supabase
    .from("quotes")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as Quote[];
}

export async function getQuote(id: string): Promise<Quote> {
  const { data, error } = await supabase.from("quotes").select("*").eq("id", id).single();
  if (error) throw error;
  return data as unknown as Quote;
}

export async function listQuoteVersions(quoteId: string): Promise<QuoteVersion[]> {
  const { data, error } = await supabase
    .from("quote_versions")
    .select("*")
    .eq("quote_id", quoteId)
    .order("version", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as QuoteVersion[];
}

type SaveInput = {
  id?: string;
  name: string;
  notes: string | null;
  sale_price: number;
  rows: QuoteRow[];
  vat_scheme: VatScheme;
  userId: string;
};

export async function saveQuote(input: SaveInput): Promise<Quote> {
  const total_cost = computeTotalCost(input.rows);
  let quote: Quote;

  if (!input.id) {
    const { data, error } = await supabase
      .from("quotes")
      .insert({
        name: input.name,
        notes: input.notes,
        sale_price: input.sale_price,
        rows: input.rows as any,
        total_cost,
        current_version: 1,
        vat_scheme: input.vat_scheme,
        created_by: input.userId,
      })
      .select("*")
      .single();
    if (error) throw error;
    quote = data as unknown as Quote;
  } else {
    const { data: existing, error: exErr } = await supabase
      .from("quotes")
      .select("current_version")
      .eq("id", input.id)
      .single();
    if (exErr) throw exErr;
    const nextVersion = (existing?.current_version ?? 0) + 1;
    const { data, error } = await supabase
      .from("quotes")
      .update({
        name: input.name,
        notes: input.notes,
        sale_price: input.sale_price,
        rows: input.rows as any,
        total_cost,
        current_version: nextVersion,
        vat_scheme: input.vat_scheme,
      })
      .eq("id", input.id)
      .select("*")
      .single();
    if (error) throw error;
    quote = data as unknown as Quote;
  }

  const { error: vErr } = await supabase.from("quote_versions").insert({
    quote_id: quote.id,
    version: quote.current_version,
    name: quote.name,
    notes: quote.notes,
    sale_price: quote.sale_price,
    rows: quote.rows as any,
    total_cost: quote.total_cost,
    vat_scheme: quote.vat_scheme,
    saved_by: input.userId,
  });
  if (vErr) throw vErr;

  return quote;
}

export async function deleteQuote(id: string): Promise<void> {
  const { error } = await supabase.from("quotes").delete().eq("id", id);
  if (error) throw error;
}
