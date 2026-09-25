// Shared line/account helpers for QuickBooks postings (incl. part exchange).
import type { QboAccounts } from './quickbooks.ts';

/**
 * Which account funds a bike's stock-in journal.
 * Part exchanges have no funding account — they are funded by the sale itself:
 * the stock-in journal credits Accounts Receivable against the customer, which
 * reduces the balance due on the full-value sale invoice. Returns null for
 * part exchanges so the caller builds that AR credit line instead.
 */
export function purchaseFundingAccount(acquiredVia: string | null | undefined, accounts: QboAccounts): string | null {
  if (acquiredVia === 'part_exchange') {
    return null;
  }
  if (!accounts.purchase_funding) {
    throw new Error('QuickBooks account mapping is incomplete (Stock and purchase funding accounts are required)');
  }
  return accounts.purchase_funding;
}

export interface SaleLineInput {
  saleGross: number;
  description: string;
  saleItemRef: string;
  saleTaxCode: string;
  /** Delivery charged to the customer; omitted or 0 when absorbed as a cost. */
  deliveryCharge?: number;
  deliveryItemRef?: string;
  /** Delivery is always standard rated, even on a margin scheme bike. */
  deliveryTaxCode?: string;
}

/**
 * Customer invoice lines: the bike at its full price, plus an optional
 * delivery charge. VAT applies to the full amount, part exchange included. A
 * part exchange is NOT a negative invoice line — it settles part of the
 * balance via the AR credit on the part-ex bike's stock-in journal.
 */
export function buildSaleInvoiceLines(input: SaleLineInput): Record<string, unknown>[] {
  const lines: Record<string, unknown>[] = [
    {
      Amount: Number(input.saleGross.toFixed(2)),
      DetailType: 'SalesItemLineDetail',
      Description: input.description || 'Bicycle sale',
      SalesItemLineDetail: {
        ItemRef: { value: input.saleItemRef },
        TaxCodeRef: { value: input.saleTaxCode },
      },
    },
  ];

  const delivery = Number(input.deliveryCharge || 0);
  if (delivery > 0 && input.deliveryItemRef) {
    lines.push({
      Amount: Number(delivery.toFixed(2)),
      DetailType: 'SalesItemLineDetail',
      Description: 'Delivery',
      SalesItemLineDetail: {
        ItemRef: { value: input.deliveryItemRef },
        TaxCodeRef: { value: input.deliveryTaxCode ?? input.saleTaxCode },
      },
    });
  }

  return lines;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

const qboJl = (posting: 'Debit' | 'Credit', account: string, amount: number, description: string) => ({
  Amount: Number(r2(amount).toFixed(2)),
  DetailType: 'JournalEntryLineDetail',
  ...(description ? { Description: description.slice(0, 4000) } : {}),
  JournalEntryLineDetail: { PostingType: posting, AccountRef: { value: account } },
});

export interface BreakKeptItem { label: string; amount: number }

/**
 * Bike broken for parts: each kept part moves from bike stock to parts stock
 * (only when a parts stock account is mapped — otherwise the value stays in
 * the main stock account), and the scrapped remainder is written off to COGS.
 * One balanced pair per kept item, so the stock ledger shows the bike
 * replaced by its parts.
 */
export function buildBreakJournalLines(
  keptItems: BreakKeptItem[],
  writtenOff: number,
  accounts: QboAccounts,
  ref: string,
): Record<string, unknown>[] {
  const lines: Record<string, unknown>[] = [];
  const kept = keptItems.filter((i) => r2(i.amount) > 0);
  if (kept.length > 0 && accounts.parts_stock) {
    if (!accounts.stock) throw new Error('QuickBooks account mapping is incomplete (Stock account is required)');
    for (const item of kept) {
      const label = item.label.slice(0, 400);
      lines.push(qboJl('Debit', accounts.parts_stock, item.amount, `Parts stock — ${label}`));
      lines.push(qboJl('Credit', accounts.stock, item.amount, `Bike ${ref} removed from stock — ${label}`));
    }
  }
  const off = r2(writtenOff);
  if (off > 0) {
    if (!accounts.cogs || !accounts.stock) throw new Error('QuickBooks account mapping is incomplete (Stock and COGS accounts are required)');
    lines.push(qboJl('Debit', accounts.cogs, off, `Written off — bike ${ref} broken for parts`));
    lines.push(qboJl('Credit', accounts.stock, off, `Bike ${ref} scrapped remainder`));
  }
  return lines;
}

/** Stock-out for a part sale: Dr COGS / Cr parts stock (or main stock when unmapped). */
export function buildPartStockOutLines(cost: number, accounts: QboAccounts, description: string): Record<string, unknown>[] {
  const c = r2(cost);
  if (c <= 0) return [];
  if (!accounts.cogs) throw new Error('QuickBooks account mapping is incomplete (COGS account is required)');
  const stockAccount = accounts.parts_stock || accounts.stock;
  if (!stockAccount) throw new Error('QuickBooks account mapping is incomplete (Stock account is required)');
  return [
    qboJl('Debit', accounts.cogs, c, `Cost of goods sold — ${description}`),
    qboJl('Credit', stockAccount, c, `Stock released — ${description}`),
  ];
}

