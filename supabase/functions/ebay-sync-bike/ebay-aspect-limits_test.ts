import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { sanitizeAspects } from '../_shared/ebay-listing.ts';
Deno.test('aspects respect eBay limits', () => {
  const long = 'Shimano Ultegra R8020 hydraulic disc brake caliper with ICE-TECH rotors flat mount';
  const r = sanitizeAspects({ Brand: ['Canyon', 'canyon', ' '], Brakes: [long], Empty: [''], ['X'.repeat(41)]: ['a'], Many: Array.from({ length: 40 }, (_, i) => `v${i}`) });
  assertEquals(r.aspects.Brand, ['Canyon']);
  assertEquals(r.aspects.Brakes[0].length <= 65, true);
  assertEquals('Empty' in r.aspects, false);
  assertEquals(r.aspects.Many.length, 30);
  assertEquals(Object.keys(r.aspects).length, 3);
});
