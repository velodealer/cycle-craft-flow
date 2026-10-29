import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { partReadiness, partTitle, partSku } from './part-listing-rules.ts';

const ready = { for_sale: true, stock_status: 'in_stock', sale_price: 40, listing_photos: ['https://x/a.jpg'], brand: 'Shimano', description: 'XT rear mech' };

Deno.test('a ticked, priced, in-stock part with a photo is ready', () => {
  assertEquals(partReadiness(ready), []);
});

Deno.test('parts not ticked for sale cannot be listed', () => {
  assertEquals(partReadiness({ ...ready, for_sale: false }).length, 1);
});

Deno.test('sold parts, missing price or no photos block listing', () => {
  assertEquals(partReadiness({ ...ready, stock_status: 'sold' }).length, 1);
  assertEquals(partReadiness({ ...ready, sale_price: 0 }).length, 1);
  assertEquals(partReadiness({ ...ready, listing_photos: [] }).length, 1);
});

Deno.test('title does not repeat the brand', () => {
  assertEquals(partTitle({ brand: 'Shimano', description: 'Shimano XT rear mech' }), 'Shimano XT rear mech');
  assertEquals(partTitle({ brand: 'Shimano', description: 'XT rear mech' }), 'Shimano XT rear mech');
  assertEquals(partTitle({ listing_title: 'Custom', brand: 'Shimano', description: 'x' }), 'Custom');
});

Deno.test('sku is stable and prefixed', () => {
  assertEquals(partSku({ id: 'abcdef12-3456-7890-abcd-ef1234567890' }), 'PART-ABCDEF123456');
});
