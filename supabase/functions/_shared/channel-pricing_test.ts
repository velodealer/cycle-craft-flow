import { assertEquals } from 'jsr:@std/assert@1';
import { applyChannelMarkup } from './channel-pricing.ts';
Deno.test('no mark-up keeps price', () => assertEquals(applyChannelMarkup(2000, { pct: 0, round: '10' }), 2000));
Deno.test('10% no rounding', () => assertEquals(applyChannelMarkup(1999, { pct: 10, round: 'none' }), 2198.9));
Deno.test('rounds up to 5/10/.99', () => {
  assertEquals(applyChannelMarkup(1999, { pct: 10, round: '5' }), 2200);
  assertEquals(applyChannelMarkup(1999, { pct: 10, round: '10' }), 2200);
  assertEquals(applyChannelMarkup(1999, { pct: 10, round: '99' }), 2198.99);
});
Deno.test('missing price stays missing', () => assertEquals(applyChannelMarkup(null, { pct: 10, round: 'none' }), null));
