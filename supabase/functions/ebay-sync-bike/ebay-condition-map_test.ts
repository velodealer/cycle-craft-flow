import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { mapCondition } from '../_shared/ebay-listing.ts';

const bikes = new Set(['1000', '1500', '3000', '7000']);

Deno.test('used grades map to general Used in bike category', () => {
  assertEquals(mapCondition('USED_VERY_GOOD', bikes), { condition: 'USED_EXCELLENT', substituted: false, collapsed: true });
  assertEquals(mapCondition('USED_ACCEPTABLE', bikes)?.condition, 'USED_EXCELLENT');
});

Deno.test('new and for-parts map directly', () => {
  assertEquals(mapCondition('NEW', bikes)?.condition, 'NEW');
  assertEquals(mapCondition('FOR_PARTS_OR_NOT_WORKING', bikes)?.condition, 'FOR_PARTS_OR_NOT_WORKING');
});

Deno.test('never falls to For parts for a working bike', () => {
  assertEquals(mapCondition('USED_GOOD', new Set(['1000', '7000'])), null);
});
