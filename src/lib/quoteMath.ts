// Pure quote money rules (no app imports) so they can be unit tested.
export type VatScheme = "standard" | "margin" | "export" | "none";

export const VAT_RATE = 0.2;

export type QuoteRow = {
  id: string;
  description: string;
  category: string;
  qty: number;
  unitCost: number;
  parentId?: string | null;
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

/** VAT contained in a single VAT-inclusive line (1/6). Child rows produce negative VAT under standard. */
export const lineVat = (r: QuoteRow, scheme: VatScheme) =>
  scheme === "standard" || scheme === "export" ? lineNet(r) / 6 : 0;

export const computeVat = (rows: QuoteRow[], salePrice: number, scheme: VatScheme) => {
  const totalCost = computeTotalCost(rows);
  const lineVatTotal =
    scheme === "standard" || scheme === "export" ? rows.reduce((s, r) => s + lineVat(r, scheme), 0) : 0;
  const profit = (Number(salePrice) || 0) - totalCost;
  const marginVat = scheme === "margin" && profit > 0 ? profit / 6 : 0;
  return {
    lineVatTotal,
    marginVat,
    // Export: no VAT charged on the sale; VAT on parts is reclaimed.
    totalVat: scheme === "export" ? 0 : lineVatTotal + marginVat,
    netCost: totalCost - lineVatTotal,
  };
};
