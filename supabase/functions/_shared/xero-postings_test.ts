import { assertEquals, assertThrows } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { marginVat, taxTypeFor, saleInvoiceLines, purchaseJournalLines, saleJournalLines, journalBalance } from './xero-postings.ts';

const accounts = { stock: '630', cogs: '310', sales: '200', vat: '820', purchase_funding: '090' };

Deno.test('margin VAT is 1/6 of the margin and never negative', () => {
  assertEquals(marginVat(1200, 600), 100);
  assertEquals(marginVat(500, 600), 0);
});

Deno.test('tax type: not VAT registered is NONE; missing mapping throws', () => {
  assertEquals(taxTypeFor(false, true, {}), 'NONE');
  assertEquals(taxTypeFor(true, false, { standard_sales: 'OUTPUT2' }), 'OUTPUT2');
  assertEquals(taxTypeFor(true, true, { margin_sales: 'NONE' }), 'NONE');
  assertThrows(() => taxTypeFor(true, true, { standard_sales: 'OUTPUT2' }));
});

Deno.test('invoice lines: bike at full value plus standard-rated delivery', () => {
  const lines = saleInvoiceLines({ gross: 1200, description: 'Bike', salesAccount: '200', saleTax: 'NONE', delivery: 30, deliveryTax: 'OUTPUT2' });
  assertEquals(lines.length, 2);
  assertEquals(lines[1].TaxType, 'OUTPUT2');
});

Deno.test('journals balance', () => {
  assertEquals(journalBalance(purchaseJournalLines(600, accounts, 'x')), 0);
  const sale = saleJournalLines(600, marginVat(1200, 600), accounts, 'x');
  assertEquals(sale.length, 4);
  assertEquals(journalBalance(sale), 0);
});
