interface Props {
  bike: any;
  partsCost: number;
  jobsCost: number;
  strippedInventoryValue?: number;
}

const formatCurrency = (amount: number | null) => (amount ? `£${amount.toFixed(2)}` : '-');

const Row = ({ label, value, negative, bold, muted, sub }: { label: string; value: string; negative?: boolean; bold?: boolean; muted?: boolean; sub?: string }) => (
  <div className="flex justify-between items-baseline py-1.5 border-b last:border-b-0 text-sm">
    <span className={muted ? 'text-muted-foreground' : ''}>{label}{sub && <span className="block text-xs text-muted-foreground">{sub}</span>}</span>
    <span className={`${bold ? 'font-semibold text-base' : ''} ${negative ? 'text-destructive' : ''}`}>{value}</span>
  </div>
);

/** Shared cost & profit breakdown for a bike (bike page and repairs approval popup). */
export default function BikeCostBreakdown({ bike, partsCost, jobsCost, strippedInventoryValue = 0 }: Props) {
  const isSold = bike.status === 'sold';
  const isSplit = bike.status === 'split_for_parts';
  const revenue = Number((isSold ? bike.sale_price : bike.asking_price) || 0);
  const acquisition = Number(bike.purchase_price ?? bike.purchase_cost ?? 0);
  const collectionCost = Number(bike.collection_cost ?? 0);
  const deliveryCost = Number(bike.delivery_cost ?? 0);
  const prep = collectionCost + deliveryCost + partsCost + jobsCost;
  const totalCost = acquisition + prep;
  const gross = revenue - totalCost;
  const isMargin = bike.finance_scheme === 'margin_scheme';
  const vat = isMargin ? Math.max(0, revenue - acquisition) * 20 / 120 : 0;
  const net = gross - vat;
  const margin = revenue > 0 ? (net / revenue) * 100 : null;
  const markupRoi = totalCost > 0 ? (net / totalCost) * 100 : null;
  const pct = (v: number | null) => (v == null ? '-' : `${v.toFixed(1)}%`);
  const siv = totalCost;
  const headroom = revenue - siv;
  const investorShare = bike.source === 'investor' && bike.profit_share_pct != null
    ? Math.max(0, net) * (Number(bike.profit_share_pct) / 100)
    : null;

  if (isSplit) {
    const residual = acquisition - strippedInventoryValue;
    return (
      <div className="mt-6">
        <h4 className="text-sm font-semibold mb-3">Stripped for parts</h4>
        <div className="space-y-0">
          <Row label="Acquisition cost" value={formatCurrency(acquisition)} muted />
          <Row label="Value moved to inventory" value={formatCurrency(strippedInventoryValue)} muted />
          <Row label="Residual (unrecovered)" value={formatCurrency(residual)} bold negative={residual > 0} />
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <h4 className="text-sm font-semibold mb-2">Cost & profit breakdown</h4>
      <p className="text-xs text-muted-foreground mb-3">{isSold ? 'Realised — based on sale price' : 'Estimated — based on listed asking price'}</p>
      <div className="space-y-0">
        <Row label={isSold ? 'Sale price' : 'Asking price'} value={formatCurrency(revenue)} bold />
        <Row label="Acquisition cost" value={`− ${formatCurrency(acquisition)}`} muted />
        <Row label="Collection cost" value={`− ${formatCurrency(collectionCost)}`} muted />
        <Row label="Delivery cost" value={`− ${formatCurrency(deliveryCost)}`} muted />
        <Row label="Parts" value={`− ${formatCurrency(partsCost)}`} muted />
        <Row label="Labour / jobs" value={`− ${formatCurrency(jobsCost)}`} muted />
        <Row label="Total costs" value={formatCurrency(totalCost)} bold />
        <Row label="Gross profit" value={formatCurrency(gross)} bold negative={gross < 0} />
        {isMargin && <Row label="VAT (margin scheme)" value={`− ${formatCurrency(vat)}`} muted />}
        <Row label="Net profit" value={formatCurrency(net)} bold negative={net < 0} />
        {investorShare != null && (
          <Row label={`Investor share (${bike.profit_share_pct}%)`} value={formatCurrency(investorShare)} bold />
        )}
      </div>

      <div className="mt-4 p-3 rounded-md border bg-muted/30 space-y-1">
        <div className="flex justify-between items-baseline">
          <div className="text-sm font-semibold">Stand-In Value (break-even price)</div>
          <div className="text-lg font-semibold">{formatCurrency(siv)}</div>
        </div>
        {revenue > 0 && (
          <div className="flex justify-between items-baseline text-sm pt-2 border-t">
            <span className="text-muted-foreground">Headroom vs SIV ({isSold ? 'sale' : 'asking'})</span>
            <span className={`font-medium ${headroom < 0 ? 'text-destructive' : ''}`}>{headroom >= 0 ? '+' : ''}{formatCurrency(headroom)}</span>
          </div>
        )}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-4">
        <div>
          <label className="text-xs font-medium text-muted-foreground">Margin</label>
          <p className="text-base font-semibold">{pct(margin)}</p>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Markup</label>
          <p className="text-base font-semibold">{pct(markupRoi)}</p>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">ROI</label>
          <p className="text-base font-semibold">{pct(markupRoi)}</p>
        </div>
      </div>
    </div>
  );
}
