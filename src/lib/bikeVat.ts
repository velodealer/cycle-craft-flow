/** Pure VAT rules for a bike's cost & profit breakdown. Import-free so Deno tests use it as-is. */
export interface BikeVatInput {
  scheme: string | null | undefined;
  revenue: number;      // sale or asking price, VAT inclusive
  acquisition: number;  // purchase price, VAT inclusive for standard-VAT schemes
  vatRegistered: boolean;
  isExport: boolean;
}

export interface BikeVatResult {
  isMargin: boolean;
  isStandardVat: boolean;
  outputVat: number;    // VAT owed on the sale
  inputVat: number;     // VAT reclaimed on the purchase
  netVat: number;       // outputVat - inputVat (taken off gross profit)
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export function bikeVat({ scheme, revenue, acquisition, vatRegistered, isExport }: BikeVatInput): BikeVatResult {
  const isMargin = vatRegistered && !isExport && scheme === 'margin_scheme';
  const isStandardVat = vatRegistered && !isExport && (scheme === 'vat_qualifying' || scheme === 'commercial_vat');
  const outputVat = isMargin ? r2(Math.max(0, revenue - acquisition) / 6) : isStandardVat ? r2(revenue / 6) : 0;
  const inputVat = isStandardVat ? r2(acquisition / 6) : 0;
  return { isMargin, isStandardVat, outputVat, inputVat, netVat: r2(outputVat - inputVat) };
}
