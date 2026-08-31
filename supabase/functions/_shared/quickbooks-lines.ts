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

