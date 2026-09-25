import { assertEquals, assertThrows } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { buildBreakJournalLines, buildPartStockOutLines } from './quickbooks-lines.ts';

const accounts = { stock: '82', cogs: '81', sales: '80', vat: '83', purchase_funding: '50', parts_stock: '84' };
const noPartsStock = { stock: '82', cogs: '81', sales: '80', vat: '83', purchase_funding: '50' };

const kept = [
  { label: 'Drivetrain: Shimano Ultegra', amount: 450 },
  { label: 'Wheels: Aeolus Comp', amount: 280 },
  { label: 'Frame: Trek Émonda (54)', amount: 120 },
];

const net = (lines: Record<string, unknown>[]) => {
  const amountOf = (l: Record<string, unknown>) => Number(l.Amount);
  const sign = (l: Record<string, unknown>) => ((l as any).JournalEntryLineDetail.PostingType === 'Debit' ? 1 : -1);
  return Math.round(lines.reduce((s, l) => s + sign(l) * amountOf(l), 0) * 100) / 100;
};

Deno.test('break journal: one balanced pair per kept item when parts stock is mapped', () => {
  const lines = buildBreakJournalLines(kept, 0, accounts, 'BPS-TRE-027T');
  assertEquals(lines.length, 6);
  assertEquals((lines[0] as any).JournalEntryLineDetail.AccountRef.value, '84');
  assertEquals((lines[1] as any).JournalEntryLineDetail.PostingType, 'Credit');
  assertEquals(net(lines), 0);
});

Deno.test('break journal: no reclass when parts stock is unmapped — value stays in stock', () => {
  assertEquals(buildBreakJournalLines(kept, 0, noPartsStock, 'BPS-TRE-027T').length, 0);
});

Deno.test('break journal: scrapped remainder is written off to COGS', () => {
  const lines = buildBreakJournalLines(kept, 130.004, accounts, 'BPS-TRE-027T');
  assertEquals(lines.length, 8);
  assertEquals(net(lines), 0);
  const noParts = buildBreakJournalLines(kept, 130, noPartsStock, 'BPS-TRE-027T');
  assertEquals(noParts.length, 2);
  assertEquals(net(noParts), 0);
});

Deno.test('break journal: throws when write-off needs missing COGS/stock', () => {
  assertThrows(() => buildBreakJournalLines(kept, 130, { parts_stock: '84' }, 'X'));
});

Deno.test('part sale stock-out: credits parts stock when mapped, main stock otherwise', () => {
  const withParts = buildPartStockOutLines(150, accounts, 'Ultegra crank');
  assertEquals((withParts[1] as any).JournalEntryLineDetail.AccountRef.value, '84');
  assertEquals(net(withParts), 0);
  const withoutParts = buildPartStockOutLines(150, noPartsStock, 'Ultegra crank');
  assertEquals((withoutParts[1] as any).JournalEntryLineDetail.AccountRef.value, '82');
  assertEquals(net(withoutParts), 0);
  assertEquals(buildPartStockOutLines(0, accounts, 'x').length, 0);
});
