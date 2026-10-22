// Run with: deno test supabase/functions/_shared/quote-math_test.ts
import { assertAlmostEquals, assertEquals } from 'jsr:@std/assert@1';
import { computeVat, computeTotalCost, type QuoteRow } from '../../../src/lib/quoteMath.ts';

const rows: QuoteRow[] = [{ id: '1', description: 'Frame', category: 'frame', qty: 1, unitCost: 120 }];

Deno.test('standard: £120 VAT-inclusive part holds £20 VAT, £100 net', () => {
  const v = computeVat(rows, 300, 'standard');
  assertAlmostEquals(v.lineVatTotal, 20);
  assertAlmostEquals(v.netCost, 100);
  assertAlmostEquals(v.totalVat, 20);
});
Deno.test('export: no VAT charged, parts VAT reclaimed so cost is ex VAT', () => {
  const v = computeVat(rows, 300, 'export');
  assertEquals(v.totalVat, 0);
  assertAlmostEquals(v.netCost, 100);
});
Deno.test('margin: VAT is 1/6 of profit', () => {
  const v = computeVat(rows, 720, 'margin');
  assertAlmostEquals(v.marginVat, 100);
  assertEquals(v.lineVatTotal, 0);
});
Deno.test('margin: loss means no VAT', () => assertEquals(computeVat(rows, 100, 'margin').totalVat, 0));
Deno.test('not VAT registered: no VAT at all', () => assertEquals(computeVat(rows, 300, 'none').totalVat, 0));
Deno.test('child rows subtract from total cost', () => {
  assertEquals(computeTotalCost([...rows, { id: '2', description: 'swap', category: 'x', qty: 1, unitCost: 20, parentId: '1' }]), 100);
});
