import { assertEquals, assertThrows } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { buildSaleInvoiceLines, purchaseFundingAccount } from './quickbooks-lines.ts';

Deno.test('purchase funding uses the normal funding account for bought bikes', () => {
  assertEquals(
    purchaseFundingAccount('purchase', { purchase_funding: '10' }),
    '10',
  );
});

Deno.test('purchase funding fails clearly when the funding account is unmapped', () => {
  assertThrows(
    () => purchaseFundingAccount('purchase', {}),
    Error,
    'purchase funding',
  );
});

Deno.test('part exchanges return null — funded by an AR credit, not a clearing account', () => {
  assertEquals(purchaseFundingAccount('part_exchange', { purchase_funding: '10' }), null);
});

Deno.test('sale lines carry the full price only (part exchange settles via AR journal)', () => {
  const lines = buildSaleInvoiceLines({
    saleGross: 4000,
    description: 'Specialized Roubaix',
    saleItemRef: '1',
    saleTaxCode: 'STD',
  });

  assertEquals(lines.length, 1);
  assertEquals((lines[0] as any).Amount, 4000);
  assertEquals((lines[0] as any).SalesItemLineDetail.TaxCodeRef.value, 'STD');
});
