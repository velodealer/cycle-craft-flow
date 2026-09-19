import {
  canonicalSize,
  groupsetLabel,
  daysBetween,
  inRange,
  priceBand,
  titleCase,
  STOCK_STATUSES,
  sum,
  avg,
  type Range,
} from '@/lib/reports';
import type { ReportsData } from '@/hooks/useReportsData';

export interface BikeRow {
  id: string;
  label: string;
  brand: string;
  model: string;
  status: string;
  size: string;
  bikeType: string;
  frameMaterial: string;
  isElectric: boolean;
  groupset: string;
  source: string;
  acquiredVia: string;
  scheme: string;
  bayId: string | null;
  intakeDate: string | null;
  saleDate: string | null;
  revenue: number;
  askingPrice: number;
  purchaseCost: number;
  logisticsCost: number;
  partsCost: number;
  labourCost: number;
  totalCost: number;
  margin: number;
  marginPct: number;
  prepCost: number;
  daysToSell: number | null;
  ageDays: number;
  isSold: boolean;
  isStock: boolean;
  priceBand: string;
}

export interface ReportFilterState {
  brand: string;
  bikeType: string;
  size: string;
  source: string;
  band: string;
}

export const EMPTY_FILTERS: ReportFilterState = {
  brand: 'all',
  bikeType: 'all',
  size: 'all',
  source: 'all',
  band: 'all',
};

/** Enrich every bike with its costs, revenue and derived spec labels. */
export function buildBikeRows(data: ReportsData): BikeRow[] {
  const partsByBike = new Map<string, any[]>();
  for (const p of data.parts) {
    if (!p.bike_id) continue;
    const list = partsByBike.get(p.bike_id) || [];
    list.push(p);
    partsByBike.set(p.bike_id, list);
  }
  const jobsByBike = new Map<string, any[]>();
  for (const j of data.jobs) {
    if (!j.bike_id) continue;
    const list = jobsByBike.get(j.bike_id) || [];
    list.push(j);
    jobsByBike.set(j.bike_id, list);
  }
  const paidInvoiceByBike = new Map<string, any>();
  for (const i of data.invoices) {
    if (!i.bike_id || i.status !== 'paid') continue;
    const existing = paidInvoiceByBike.get(i.bike_id);
    if (!existing || new Date(i.paid_at || i.issued_at || 0) > new Date(existing.paid_at || existing.issued_at || 0)) {
      paidInvoiceByBike.set(i.bike_id, i);
    }
  }

  return data.bikes.map((b) => {
    const parts = partsByBike.get(b.id) || [];
    const jobs = jobsByBike.get(b.id) || [];
    const partsCost = sum(parts, (p) => Number(p.cost_price || 0) * Number(p.quantity || 1));
    const labourCost = sum(jobs, (j) => Number(j.actual_cost ?? j.estimated_cost ?? 0));
    const purchaseCost = Number(b.purchase_price ?? b.purchase_cost ?? 0);
    const logisticsCost = Number(b.collection_cost || 0) + Number(b.delivery_cost || 0);
    const totalCost = purchaseCost + logisticsCost + partsCost + labourCost;

    const invoice = paidInvoiceByBike.get(b.id);
    const isSold = b.status === 'sold';
    const saleDate = b.sold_at || invoice?.paid_at || (isSold ? b.updated_at : null) || null;
    const revenue = Number(invoice?.gross ?? invoice?.total ?? b.sale_price ?? 0);
    const margin = isSold ? revenue - totalCost : 0;

    const intakeDate = b.intake_date || b.created_at || null;
    const daysToSell = isSold && saleDate && intakeDate ? Math.max(0, daysBetween(intakeDate, new Date(saleDate))) : null;

    return {
      id: b.id,
      label: `${b.make || ''} ${b.model || ''}`.trim() || 'Bike',
      brand: (b.make || 'Unknown').trim(),
      model: (b.model || '—').trim(),
      status: b.status,
      size: canonicalSize(b.size) || 'Not recorded',
      bikeType: b.bike_type ? titleCase(b.bike_type) : 'Not recorded',
      frameMaterial: b.frame_material || 'Not recorded',
      isElectric: !!b.is_electric,
      groupset: groupsetLabel(b),
      source: titleCase(b.source),
      acquiredVia: titleCase(b.acquired_via),
      scheme: titleCase(b.finance_scheme),
      bayId: b.storage_bay_id || null,
      intakeDate,
      saleDate,
      revenue,
      askingPrice: Number(b.asking_price || 0),
      purchaseCost,
      logisticsCost,
      partsCost,
      labourCost,
      totalCost,
      margin,
      marginPct: revenue > 0 ? margin / revenue : 0,
      prepCost: partsCost + labourCost,
      daysToSell,
      ageDays: daysBetween(intakeDate),
      isSold,
      isStock: STOCK_STATUSES.includes(b.status),
      priceBand: priceBand(revenue || Number(b.asking_price || 0)),
    };
  });
}

export function applyFilters(rows: BikeRow[], f: ReportFilterState) {
  return rows.filter((r) =>
    (f.brand === 'all' || r.brand === f.brand) &&
    (f.bikeType === 'all' || r.bikeType === f.bikeType) &&
    (f.size === 'all' || r.size === f.size) &&
    (f.source === 'all' || r.source === f.source) &&
    (f.band === 'all' || r.priceBand === f.band));
}

export const soldIn = (rows: BikeRow[], range: Range) => rows.filter((r) => r.isSold && inRange(r.saleDate, range));

export interface PeriodStats {
  revenue: number;
  units: number;
  grossProfit: number;
  avgProfit: number;
  avgSalePrice: number;
  avgDaysToSell: number;
  avgPrepCost: number;
  marginPct: number;
  serviceRevenue: number;
  stockUnits: number;
  stockValue: number;
  agingUnits: number;
  agingValue: number;
  sellThrough: number;
  intakeUnits: number;
}

export function periodStats(rows: BikeRow[], data: ReportsData, range: Range): PeriodStats {
  const sold = soldIn(rows, range);
  const ids = new Set(rows.map((r) => r.id));

  const paid = data.invoices.filter((i) => i.status === 'paid' && inRange(i.paid_at, range) && (!i.bike_id || ids.has(i.bike_id)));
  const revenue = sum(paid, (i) => Number(i.gross || i.total || 0)) || sum(sold, (r) => r.revenue);
  const serviceRevenue = sum(paid.filter((i) => i.type !== 'sale'), (i) => Number(i.gross || i.total || 0));

  const grossProfit = sum(sold, (r) => r.margin);
  const stock = rows.filter((r) => r.isStock);
  const aging = stock.filter((r) => r.ageDays > 90);
  const intakeUnits = rows.filter((r) => inRange(r.intakeDate, range)).length;

  return {
    revenue,
    units: sold.length,
    grossProfit,
    avgProfit: sold.length ? grossProfit / sold.length : 0,
    avgSalePrice: avg(sold, (r) => r.revenue),
    avgDaysToSell: avg(sold.filter((r) => r.daysToSell != null), (r) => r.daysToSell || 0),
    avgPrepCost: avg(sold, (r) => r.prepCost),
    marginPct: revenue > 0 ? grossProfit / revenue : 0,
    serviceRevenue,
    stockUnits: stock.length,
    stockValue: sum(stock, (r) => r.purchaseCost),
    agingUnits: aging.length,
    agingValue: sum(aging, (r) => r.purchaseCost),
    sellThrough: stock.length + sold.length > 0 ? sold.length / (stock.length + sold.length) : 0,
    intakeUnits,
  };
}

/** Per-group sales aggregate used by brand / spec / size tables. */
export interface GroupStat {
  key: string;
  sold: number;
  revenue: number;
  cost: number;
  margin: number;
  marginPct: number;
  avgSale: number;
  avgBuy: number;
  avgMargin: number;
  avgDays: number;
  inStock: number;
  aging: number;
  stockValue: number;
}

export function groupStats(rows: BikeRow[], sold: BikeRow[], key: (r: BikeRow) => string): GroupStat[] {
  const keys = new Set<string>([...rows.map(key), ...sold.map(key)]);
  const out: GroupStat[] = [];
  for (const k of keys) {
    const s = sold.filter((r) => key(r) === k);
    const stock = rows.filter((r) => r.isStock && key(r) === k);
    const revenue = sum(s, (r) => r.revenue);
    const cost = sum(s, (r) => r.totalCost);
    const margin = revenue - cost;
    out.push({
      key: k,
      sold: s.length,
      revenue,
      cost,
      margin,
      marginPct: revenue > 0 ? margin / revenue : 0,
      avgSale: avg(s, (r) => r.revenue),
      avgBuy: avg(s, (r) => r.purchaseCost),
      avgMargin: s.length ? margin / s.length : 0,
      avgDays: avg(s.filter((r) => r.daysToSell != null), (r) => r.daysToSell || 0),
      inStock: stock.length,
      aging: stock.filter((r) => r.ageDays > 90).length,
      stockValue: sum(stock, (r) => r.purchaseCost),
    });
  }
  return out.sort((a, b) => b.sold - a.sold || b.inStock - a.inStock);
}
