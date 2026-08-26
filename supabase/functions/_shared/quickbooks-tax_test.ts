import { assertEquals, assertThrows } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { mapSalesTaxCodes, taxCodeForScheme } from './quickbooks-tax.ts';

Deno.test('maps company tax codes with their sales rates', () => {
  const result = mapSalesTaxCodes(
    [
      { Id: 'standard', Name: '20.0% S', SalesTaxRateList: { TaxRateDetail: [{ TaxRateRef: { value: 'rate-20' } }] } },
      { Id: 'exempt', Name: 'Exempt', SalesTaxRateList: { TaxRateDetail: [{ TaxRateRef: { value: 'rate-0' } }] } },
    ],
    [{ Id: 'rate-20', RateValue: 20 }, { Id: 'rate-0', RateValue: 0 }],
  );

  assertEquals(result, [
    { id: 'standard', name: '20.0% S', rate: 20 },
    { id: 'exempt', name: 'Exempt', rate: 0 },
  ]);
});

Deno.test('chooses the configured tax code for each sale scheme', () => {
  const settings = { standard_sales: 'standard', margin_sales: 'exempt' };
  assertEquals(taxCodeForScheme(false, settings), 'standard');
  assertEquals(taxCodeForScheme(true, settings), 'exempt');
});

Deno.test('requires a tax code before attempting a sync', () => {
  assertThrows(() => taxCodeForScheme(false, {}), Error, 'Standard VAT');
  assertThrows(() => taxCodeForScheme(true, {}), Error, 'margin-scheme');
});