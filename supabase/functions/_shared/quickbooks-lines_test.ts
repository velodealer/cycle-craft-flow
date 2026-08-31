import { assertEquals, assertThrows } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { buildSaleInvoiceLines, purchaseFundingAccount } from './quickbooks-lines.ts';

Deno.test('purchase funding uses the normal funding account for bought bikes', () => {
  assertEquals(
    purchaseFundingAccount('purchase', { purchase_funding: '10', part_exchange: '20' }),
    '10',
  );
});

Deno.test('purchase funding uses the clearing account for part exchanges', () => {
  assertEquals(
    purchaseFundingAccount('part_exchange', { purchase_funding: '10', part_exchange: '20' }),
    '20',
  );
});

Deno.test('purchase funding fails clearly when the clearing account is unmapped', () => {
  assertThrows(
    () => purchaseFundingAccount('part_exchange', { purchase_funding: '10' }),
    Error,
    'Part exchange clearing',
  );
});

Deno.test('sale lines carry the full price and a negative no-VAT allowance line', () => {
  const lines = buildSaleInvoiceLines({
    saleGross: 4000,
    partExchangeValue: 1200,
    description: 'Specialized Roubaix',
    saleItemRef: '1',
    saleTaxCode: 'STD',
    partExchangeItemRef: '2',
    noVatTaxCode: 'ZERO',
  });

  assertEquals(lines.length, 2);
  assertEquals((lines[0] as any).Amount, 4000);
  assertEquals((lines[0] as any).SalesItemLineDetail.TaxCodeRef.value, 'STD');
  assertEquals((lines[1] as any).Amount, -1200);
  assertEquals((lines[1] as any).SalesItemLineDetail.ItemRef.value, '2');
  assertEquals((lines[1] as any).SalesItemLineDetail.TaxCodeRef.value, 'ZERO');
});

Deno.test('sale lines omit the allowance line without a part exchange', () => {
  const lines = buildSaleInvoiceLines({
    saleGross: 2500,
    partExchangeValue: 0,
    description: 'Trek Domane',
    saleItemRef: '1',
    saleTaxCode: 'NON',
    noVatTaxCode: 'NON',
  });
  assertEquals(lines.length, 1);
});
