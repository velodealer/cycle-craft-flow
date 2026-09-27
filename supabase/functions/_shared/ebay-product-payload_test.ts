import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { ebayInventoryProduct } from './ebay-listing.ts';

Deno.test('eBay product keeps Brand as an item specific without catalogue BrandMPN fields', () => {
  const product = ebayInventoryProduct(
    {
      id: 'bike-1',
      make: 'Trek',
      model: 'Émonda SL 6 Pro Di2',
      mpn: 'INTERNAL-ONLY',
      description: 'A used road bike.',
    },
    'Trek Émonda SL 6 Pro Di2',
    ['https://api.velodealer.com/storage/v1/object/public/bike-photos/bike.jpg'],
    { Brand: ['Trek'], 'Bike Type': ['Road Bike'] },
  );

  assertEquals(product.aspects, { Brand: ['Trek'], 'Bike Type': ['Road Bike'] });
  assertEquals('brand' in product, false);
  assertEquals('mpn' in product, false);
});