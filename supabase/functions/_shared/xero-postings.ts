// Pure Xero posting builders — same VAT/margin maths as the QuickBooks postings.
import type { XeroAccounts, XeroTaxTypes } from './xero.ts';

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Margin scheme VAT: 1/6 of (sale − purchase), never negative. */
export function marginVat(gross: number, purchase: number): number {
  return r2(Math.max(0, gross - purchase) * 20 / 120);
}

/** TaxType for a sale line. Not VAT registered → NONE. */
export function taxTypeFor(vatRegistered: boolean, isMargin: boolean, t: XeroTaxTypes = {}): string {
  if (!vatRegistered) return 'NONE';
  const v = isMargin ? t.margin_sales : t.standard_sales;
  if (!v) throw new Error(`Choose the Xero VAT rate for ${isMargin ? 'margin scheme' : 'standard'} sales in Settings → Integrations → Xero.`);
  return v;
}

export interface SaleLinesInput {
  gross: number;
  description: string;
  salesAccount: string;
  saleTax: string;
  delivery?: number;
  deliveryTax?: string;
}

/** Invoice lines (VAT-inclusive amounts): the bike at full value plus optional delivery. */
export function saleInvoiceLines(i: SaleLinesInput) {
  const lines: Record<string, unknown>[] = [{
    Description: i.description || 'Bicycle sale',
    Quantity: 1,
    UnitAmount: r2(i.gross),
    AccountCode: i.salesAccount,
    TaxType: i.saleTax,
  }];
  const d = Number(i.delivery || 0);
  if (d > 0) {
    lines.push({ Description: 'Delivery', Quantity: 1, UnitAmount: r2(d), AccountCode: i.salesAccount, TaxType: i.deliveryTax ?? i.saleTax });
  }
  return lines;
}

/** Manual journal line: positive = debit, negative = credit. */
const jl = (code: string, amount: number, description: string) => ({ LineAmount: r2(amount), AccountCode: code, Description: description, TaxType: 'NONE' });

/** Stock-in: Dr stock / Cr funding (purchase price only). */
export function purchaseJournalLines(amount: number, a: XeroAccounts, label: string) {
  if (!a.stock || !a.purchase_funding) throw new Error('Xero account mapping is incomplete (Stock and purchase funding accounts are required)');
  return [jl(a.stock, amount, label), jl(a.purchase_funding, -amount, label)];
}

/** Stock-out: Dr COGS / Cr stock, plus margin VAT Dr sales / Cr VAT. */
export function saleJournalLines(purchase: number, mVat: number, a: XeroAccounts, description: string) {
  const lines: ReturnType<typeof jl>[] = [];
  if (purchase > 0) {
    if (!a.cogs || !a.stock) throw new Error('Xero account mapping is incomplete (Stock and cost of sales accounts are required)');
    lines.push(jl(a.cogs, purchase, `Cost of goods sold — ${description}`));
    lines.push(jl(a.stock, -purchase, `Stock released — ${description}`));
  }
  if (mVat > 0) {
    if (!a.vat || !a.sales) throw new Error('A VAT account must be mapped in Xero settings for margin scheme sales');
    lines.push(jl(a.sales, mVat, `Margin scheme VAT (sales adjustment) — ${description}`));
    lines.push(jl(a.vat, -mVat, `Margin scheme VAT — ${description}`));
  }
  return lines;
}

export const journalBalance = (lines: { LineAmount: number }[]) => r2(lines.reduce((s, l) => s + l.LineAmount, 0));

export interface BreakKeptItem { label: string; amount: number }

/**
 * Bike broken for parts: each kept part moves from bike stock to parts stock
 * (only when a parts stock account is mapped — otherwise the value stays in
 * the main stock account), and the scrapped remainder is written off to COGS.
 * One balanced pair per kept item, so the stock ledger shows the bike
 * replaced by its parts.
 */
export function breakJournalLines(keptItems: BreakKeptItem[], writtenOff: number, a: XeroAccounts, ref: string) {
  const lines: ReturnType<typeof jl>[] = [];
  const kept = keptItems.filter((i) => r2(i.amount) > 0);
  if (kept.length > 0 && a.parts_stock) {
    if (!a.stock) throw new Error('Xero account mapping is incomplete (Stock account is required)');
    for (const item of kept) {
      const label = item.label.slice(0, 200);
      lines.push(jl(a.parts_stock, item.amount, `Parts stock — ${label}`));
      lines.push(jl(a.stock, -item.amount, `Bike ${ref} removed from stock — ${label}`));
    }
  }
  const off = r2(writtenOff);
  if (off > 0) {
    if (!a.cogs || !a.stock) throw new Error('Xero account mapping is incomplete (Stock and cost of sales accounts are required)');
    lines.push(jl(a.cogs, off, `Written off — bike ${ref} broken for parts`));
    lines.push(jl(a.stock, -off, `Bike ${ref} scrapped remainder`));
  }
  return lines;
}

/** Stock-out for a part sale: Dr COGS / Cr parts stock (or main stock when unmapped). */
export function partSaleStockOutLines(cost: number, a: XeroAccounts, description: string) {
  const c = r2(cost);
  if (c <= 0) return [] as ReturnType<typeof jl>[];
  if (!a.cogs) throw new Error('Xero account mapping is incomplete (Cost of sales account is required)');
  const stockAccount = a.parts_stock || a.stock;
  if (!stockAccount) throw new Error('Xero account mapping is incomplete (Stock account is required)');
  return [
    jl(a.cogs, c, `Cost of goods sold — ${description}`),
    jl(stockAccount, -c, `Stock released — ${description}`),
  ];
}

/** Part-sale journal: part stock-out plus margin VAT Dr sales / Cr VAT. */
export function partSaleJournalLines(cost: number, mVat: number, a: XeroAccounts, description: string) {
  const lines = partSaleStockOutLines(cost, a, description);
  const v = r2(mVat);
  if (v > 0) {
    if (!a.vat || !a.sales) throw new Error('A VAT account must be mapped in Xero settings for margin scheme sales');
    lines.push(jl(a.sales, v, `Margin scheme VAT (sales adjustment) — ${description}`));
    lines.push(jl(a.vat, -v, `Margin scheme VAT — ${description}`));
  }
  return lines;
}
