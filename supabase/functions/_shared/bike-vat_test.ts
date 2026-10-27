import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { bikeVat } from '../../../src/lib/bikeVat.ts';

const base = { vatRegistered: true, isExport: false };

Deno.test('VAT qualifying: 20% on sale, purchase VAT reclaimed', () => {
  const v = bikeVat({ ...base, scheme: 'vat_qualifying', revenue: 1200, acquisition: 600 });
  assertEquals(v.outputVat, 200);
  assertEquals(v.inputVat, 100);
  assertEquals(v.netVat, 100);
});

Deno.test('Commercial VAT reclaims purchase VAT too', () => {
  assertEquals(bikeVat({ ...base, scheme: 'commercial_vat', revenue: 1200, acquisition: 600 }).inputVat, 100);
});

Deno.test('Margin scheme: no purchase VAT reclaimed', () => {
  const v = bikeVat({ ...base, scheme: 'margin_scheme', revenue: 1200, acquisition: 600 });
  assertEquals(v.outputVat, 100);
  assertEquals(v.inputVat, 0);
});

Deno.test('Export and unregistered: no VAT either way', () => {
  assertEquals(bikeVat({ ...base, isExport: true, scheme: 'vat_qualifying', revenue: 1200, acquisition: 600 }).netVat, 0);
  assertEquals(bikeVat({ ...base, vatRegistered: false, scheme: 'vat_qualifying', revenue: 1200, acquisition: 600 }).netVat, 0);
});
