// Shared line/account helpers for QuickBooks postings (incl. part exchange).
import type { QboAccounts } from './quickbooks.ts';

/**
 * Which account funds a bike's stock-in journal.
 * Part exchanges are funded by the sale, via the part-exchange clearing account.
 */
export function purchaseFundingAccount(acquiredVia: string | null | undefined, accounts: QboAccounts): string {
  if (acquiredVia === 'part_exchange') {
    if (!accounts.part_exchange) {
      throw new Error('Map a QuickBooks "Part exchange clearing" account in Settings, then retry this posting.');
    }
    return accounts.part_exchange;
  }
  if (!accounts.purchase_funding) {
    throw new Error('QuickBooks account mapping is incomplete (Stock and purchase funding accounts are required)');
  }
  return accounts.purchase_funding;
}

export interface SaleLineInput {
  saleGross: number;
  partExchangeValue: number;
  description: string;
  saleItemRef: string;
  saleTaxCode: string;
  partExchangeItemRef?: string;
  noVatTaxCode: string;
}

/**
 * Customer invoice lines: the bike at its full price (VAT applies to the full
 * amount) and, when there is a part exchange, a negative allowance line with no
 * VAT so the balance due drops but output VAT does not.
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

  if (input.partExchangeValue > 0) {
    if (!input.partExchangeItemRef) {
      throw new Error('A part exchange item is required to invoice a part exchange allowance');
    }
    lines.push({
      Amount: -Number(input.partExchangeValue.toFixed(2)),
      DetailType: 'SalesItemLineDetail',
      Description: `Part exchange allowance — ${input.description || 'bike taken in part exchange'}`,
      SalesItemLineDetail: {
        ItemRef: { value: input.partExchangeItemRef },
        TaxCodeRef: { value: input.noVatTaxCode },
      },
    });
  }

  return lines;
}
