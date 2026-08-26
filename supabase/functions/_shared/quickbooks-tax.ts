export interface QboTaxCodeRef {
  standard_sales?: string;
  margin_sales?: string;
}

export interface QboTaxCode {
  id: string;
  name: string;
  rate: number | null;
}

type QboTaxRate = { Id?: string; RateValue?: number };
type QboTaxRateDetail = { TaxRateRef?: { value?: string } };
type QboTaxCodeRecord = {
  Id?: string;
  Name?: string;
  SalesTaxRateList?: { TaxRateDetail?: QboTaxRateDetail[] };
};

export function mapSalesTaxCodes(taxCodes: QboTaxCodeRecord[], taxRates: QboTaxRate[]): QboTaxCode[] {
  const rates = new Map(
    taxRates
      .filter((rate) => rate.Id)
      .map((rate) => [rate.Id as string, Number(rate.RateValue ?? 0)]),
  );

  return taxCodes
    .filter((code) => code.Id && code.Name)
    .map((code) => {
      const details = code.SalesTaxRateList?.TaxRateDetail ?? [];
      const knownRates = details
        .map((detail) => detail.TaxRateRef?.value)
        .filter((id): id is string => Boolean(id))
        .map((id) => rates.get(id))
        .filter((rate): rate is number => typeof rate === 'number');

      return {
        id: code.Id as string,
        name: code.Name as string,
        rate: knownRates.length > 0
          ? knownRates.reduce((total, rate) => total + rate, 0)
          : null,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function taxCodeForScheme(isMargin: boolean, taxCodes?: QboTaxCodeRef): string {
  const value = isMargin ? taxCodes?.margin_sales : taxCodes?.standard_sales;
  if (value) return value;
  throw new Error(
    isMargin
      ? 'Select a QuickBooks No VAT / margin-scheme tax code in Settings, then retry this invoice.'
      : 'Select a QuickBooks Standard VAT sales tax code in Settings, then retry this invoice.',
  );
}