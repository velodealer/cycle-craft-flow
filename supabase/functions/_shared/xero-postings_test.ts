import { assertEquals, assertThrows } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { breakJournalLines, partSaleStockOutLines, partSaleJournalLines } from './xero-postings.ts';

const accounts = { stock: '630', cogs: '310', sales: '200', vat: '820', purchase_funding: '090', parts_stock: '631' };
const noPartsStock = { stock: '630', cogs: '310', sales: '200', vat: '820', purchase_funding: '090' };

const kept = [
  { label: 'Drivetrain: Shimano Ultegra', amount: 450 },
  { label: 'Wheels: Aeolus Comp', amount: 280 },
  { label: 'Frame: Trek Émonda (54)', amount: 120 },
];

Deno.test('break journal: one balanced pair per kept item when parts stock is mapped', () => {
  const lines = breakJournalLines(kept, 0, accounts, 'BPS-TRE-027T');
  assertEquals(lines.length, 6);
  assertEquals(lines[0].AccountCode, '631');
  assertEquals(lines[1].AccountCode, '630');
  assertEquals(journalBalanceSafe(lines), 0);
});

Deno.test('break journal: no reclass when parts stock is unmapped — value stays in stock', () => {
  const lines = breakJournalLines(kept, 0, noPartsStock, 'BPS-TRE-027T');
  assertEquals(lines.length, 0);
});

Deno.test('break journal: scrapped remainder is written off to COGS', () => {
  const lines = breakJournalLines(kept, 130, accounts, 'BPS-TRE-027T');
  assertEquals(lines.length, 8);
  assertEquals(lines[6].AccountCode, '310');
  assertEquals(lines[7].AccountCode, '630');
  assertEquals(journalBalanceSafe(lines), 0);
  const noParts = breakJournalLines(kept, 130, noPartsStock, 'BPS-TRE-027T');
  assertEquals(noParts.length, 2);
  assertEquals(journalBalanceSafe(noParts), 0);
});

Deno.test('break journal: throws when write-off needs missing COGS/stock', () => {
  assertThrows(() => breakJournalLines(kept, 130, { parts_stock: '631' }, 'X'));
});

Deno.test('part sale stock-out: credits parts stock when mapped, main stock otherwise', () => {
  const withParts = partSaleStockOutLines(150, accounts, 'Ultegra crank');
  assertEquals(withParts[1].AccountCode, '631');
  assertEquals(journalBalanceSafe(withParts), 0);
  const withoutParts = partSaleStockOutLines(150, noPartsStock, 'Ultegra crank');
  assertEquals(withoutParts[1].AccountCode, '630');
  assertEquals(journalBalanceSafe(withoutParts), 0);
  assertEquals(partSaleStockOutLines(0, accounts, 'x').length, 0);
});

Deno.test('part sale journal: stock-out plus margin VAT lines balance', () => {
  const lines = partSaleJournalLines(150, 50, accounts, 'Ultegra crank');
  assertEquals(lines.length, 4);
  assertEquals(journalBalanceSafe(lines), 0);
});

function journalBalanceSafe(lines: { LineAmount: number }[]) {
  return Math.round(lines.reduce((s, l) => s + l.LineAmount, 0) * 100) / 100;
}
