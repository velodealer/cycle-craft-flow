import {
  differenceInCalendarDays,
  format,
  startOfDay,
  endOfDay,
  startOfWeek,
  startOfMonth,
  startOfQuarter,
  startOfYear,
  subYears,
} from 'date-fns';

export type Range = { from: Date; to: Date };

export const PIPELINE_STATUSES = [
  'pending_intake',
  'intake',
  'cleaning',
  'inspection',
  'repair',
  'ready',
  'listed',
  'sold',
] as const;

export const STOCK_STATUSES = [
  'pending_intake',
  'intake',
  'in_stock',
  'cleaning',
  'inspection',
  'pending_approval',
  'repair',
  'ready',
  'listed',
  'awaiting_collection',
  'collection_in_progress',
  'in_transit',
  'collected',
];

export const AGE_BUCKETS = [
  { label: '0–30', min: 0, max: 30 },
  { label: '31–60', min: 31, max: 60 },
  { label: '61–90', min: 61, max: 90 },
  { label: '91–180', min: 91, max: 180 },
  { label: '180+', min: 181, max: Infinity },
];

export function bucketFor(days: number) {
  return AGE_BUCKETS.find((b) => days >= b.min && days <= b.max)?.label ?? '180+';
}

export function daysBetween(a: Date | string | null | undefined, b: Date = new Date()) {
  if (!a) return 0;
  return differenceInCalendarDays(b, new Date(a));
}

export function inRange(d: Date | string | null | undefined, r: Range) {
  if (!d) return false;
  const t = new Date(d).getTime();
  return t >= r.from.getTime() && t <= r.to.getTime();
}

export const money = (n: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(n || 0);

export const moneyExact = (n: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n || 0);

export const pct = (n: number) => `${((n || 0) * 100).toFixed(1)}%`;

export const num = (n: number, dp = 1) => (Number.isFinite(n) ? n.toFixed(dp) : '—');

export type Granularity = 'day' | 'week' | 'month' | 'quarter';

export function autoGranularity(r: Range): Granularity {
  const d = differenceInCalendarDays(r.to, r.from);
  if (d <= 31) return 'day';
  if (d <= 120) return 'week';
  if (d <= 800) return 'month';
  return 'quarter';
}

export function bucketDate(d: Date, g: Granularity) {
  if (g === 'day') return startOfDay(d);
  if (g === 'week') return startOfWeek(d, { weekStartsOn: 1 });
  if (g === 'quarter') return startOfQuarter(d);
  return startOfMonth(d);
}

export function formatBucket(d: Date, g: Granularity) {
  if (g === 'day') return format(d, 'd MMM');
  if (g === 'week') return format(d, "'W'w MMM");
  if (g === 'quarter') return `Q${Math.floor(d.getMonth() / 3) + 1} ${format(d, 'yy')}`;
  return format(d, 'MMM yy');
}

/* ---------------------------------------------------------------- periods */

export const PERIOD_PRESETS = [
  { id: 'wtd', label: 'This week' },
  { id: 'mtd', label: 'This month' },
  { id: 'qtd', label: 'This quarter' },
  { id: '30d', label: '30 days' },
  { id: '90d', label: '90 days' },
  { id: 'ytd', label: 'YTD' },
  { id: 'fy', label: 'Financial YTD' },
  { id: 'last_fy', label: 'Last FY' },
  { id: '12m', label: '12 months' },
  { id: 'all', label: 'All time' },
] as const;

/** UK financial year starts 6 April. */
export function fiscalYearStart(d: Date): Date {
  const year = d.getMonth() > 2 || (d.getMonth() === 3 && d.getDate() >= 6) ? d.getFullYear() : d.getFullYear() - 1;
  return new Date(year, 3, 6, 0, 0, 0, 0);
}

export function presetRange(preset: string): Range {
  const now = new Date();
  const to = endOfDay(now);
  let from = new Date(now);
  switch (preset) {
    case 'wtd': from = startOfWeek(now, { weekStartsOn: 1 }); break;
    case 'mtd': from = startOfMonth(now); break;
    case 'qtd': from = startOfQuarter(now); break;
    case '7d': from.setDate(now.getDate() - 7); from = startOfDay(from); break;
    case '30d': from.setDate(now.getDate() - 30); from = startOfDay(from); break;
    case '90d': from.setDate(now.getDate() - 90); from = startOfDay(from); break;
    case 'ytd': from = startOfYear(now); break;
    case 'fy': from = fiscalYearStart(now); break;
    case 'last_fy': {
      const start = fiscalYearStart(now);
      const prevStart = new Date(start.getFullYear() - 1, 3, 6, 0, 0, 0, 0);
      return { from: prevStart, to: new Date(start.getTime() - 1) };
    }
    case '12m': from = startOfDay(subYears(now, 1)); break;
    case 'all': from = new Date(2000, 0, 1); break;
    default: from.setDate(now.getDate() - 90); from = startOfDay(from);
  }
  return { from, to };
}

export type CompareMode = 'none' | 'prev' | 'yoy';

export function comparisonRange(r: Range, mode: CompareMode): Range | null {
  if (mode === 'none') return null;
  if (mode === 'yoy') return { from: subYears(r.from, 1), to: subYears(r.to, 1) };
  const span = r.to.getTime() - r.from.getTime();
  return { from: new Date(r.from.getTime() - span - 1), to: new Date(r.from.getTime() - 1) };
}

export function rangeLabel(r: Range) {
  return `${format(r.from, 'd MMM yy')} – ${format(r.to, 'd MMM yy')}`;
}

export type Delta = { abs: number; pct: number | null };

export function delta(current: number, previous: number | undefined | null): Delta | null {
  if (previous === undefined || previous === null) return null;
  const abs = current - previous;
  return { abs, pct: previous !== 0 ? abs / Math.abs(previous) : null };
}

/* ------------------------------------------------------------ aggregation */

export function sum<T>(arr: T[], f: (t: T) => number) {
  return arr.reduce((s, t) => s + (Number(f(t)) || 0), 0);
}

export function avg<T>(arr: T[], f: (t: T) => number) {
  return arr.length ? sum(arr, f) / arr.length : 0;
}

export function median(values: number[]) {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function groupBy<T>(arr: T[], key: (t: T) => string) {
  const map = new Map<string, T[]>();
  for (const item of arr) {
    const k = key(item);
    const list = map.get(k);
    if (list) list.push(item);
    else map.set(k, [item]);
  }
  return map;
}

/* ------------------------------------------------------------ spec labels */

/** Sizes are free text ("54cm", "54", "M - 54", "Large") — reduce to a canonical key. */
export function canonicalSize(raw: string | null | undefined): string | null {
  const s = (raw || '').toLowerCase().trim();
  if (!s) return null;
  const n = s.match(/\d{2}/);
  if (n) return `${n[0]}cm`;
  if (/3xs|xxxs/.test(s)) return '3XS';
  if (/2xs|xxs/.test(s)) return '2XS';
  if (/\bxs\b|extra small|x-small/.test(s)) return 'XS';
  if (/\bs\b|small/.test(s)) return 'S';
  if (/\bm\b|medium/.test(s)) return 'M';
  if (/2xl|xxl/.test(s)) return '2XL';
  if (/\bxl\b|x-large|extra large/.test(s)) return 'XL';
  if (/\bl\b|\blg\b|large/.test(s)) return 'L';
  return s.toUpperCase();
}

const GROUPSET_FAMILIES = [
  'dura-ace', 'ultegra', '105', 'tiagra', 'sora', 'claris', 'grx', 'xtr', 'xt', 'slx', 'deore', 'cues', 'alivio', 'altus', 'acera',
  'red', 'force', 'rival', 'apex', 'transmission', 'eagle', 'gx', 'nx', 'sx', 'xx1', 'x01',
  'super record', 'record', 'chorus', 'potenza', 'centaur', 'ekar',
  'rotor', 'microshift', 'box', 'trp', 'sensah',
];

export function groupsetLabel(bike: any): string {
  const raw = String(bike?.spec_values?.drivetrain?.groupset || '').trim();
  if (!raw) return 'Not recorded';
  const lower = raw.toLowerCase();
  const family = GROUPSET_FAMILIES.find((f) => lower.includes(f));
  if (!family) return raw;
  return family
    .split(/[\s-]/)
    .map((w) => (w.length <= 3 ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1)))
    .join(family.includes('-') ? '-' : ' ');
}

export const PRICE_BANDS = [
  { label: 'Under £500', min: 0, max: 500 },
  { label: '£500–£1k', min: 500, max: 1000 },
  { label: '£1k–£2k', min: 1000, max: 2000 },
  { label: '£2k–£3.5k', min: 2000, max: 3500 },
  { label: '£3.5k–£5k', min: 3500, max: 5000 },
  { label: '£5k+', min: 5000, max: Infinity },
];

export function priceBand(value: number): string {
  if (!value) return 'No price';
  return PRICE_BANDS.find((b) => value >= b.min && value < b.max)?.label ?? '£5k+';
}

export function titleCase(s: string | null | undefined) {
  if (!s) return '—';
  return String(s).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/* ------------------------------------------------------------------- csv  */

export function toCsv(headers: string[], rows: (string | number)[][]) {
  const esc = (v: string | number) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))].join('\n');
}

export function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const blob = new Blob([toCsv(headers, rows)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
