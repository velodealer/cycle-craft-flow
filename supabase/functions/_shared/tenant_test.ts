import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { rowAllowed } from './tenant.ts';

const A = '11111111-1111-1111-1111-111111111111';
const B = '22222222-2222-2222-2222-222222222222';

Deno.test('dealer cannot act on another dealer\'s row', () => {
  assertEquals(rowAllowed({ businessId: A, superAdmin: false }, B), false);
});
Deno.test('dealer can act on own row', () => {
  assertEquals(rowAllowed({ businessId: A, superAdmin: false }, A), true);
});
Deno.test('user with no dealership is refused', () => {
  assertEquals(rowAllowed({ businessId: null, superAdmin: false }, A), false);
});
Deno.test('row without dealership is refused for dealers', () => {
  assertEquals(rowAllowed({ businessId: A, superAdmin: false }, null), false);
});
Deno.test('super admin and trusted server calls are allowed', () => {
  assertEquals(rowAllowed({ businessId: null, superAdmin: true }, B), true);
  assertEquals(rowAllowed(null, B), true);
});
