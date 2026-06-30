import { differenceInCalendarDays, format, startOfDay, startOfWeek, startOfMonth } from 'date-fns';

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

export const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

export type Granularity = 'day' | 'week' | 'month';

export function autoGranularity(r: Range): Granularity {
  const d = differenceInCalendarDays(r.to, r.from);
  if (d <= 31) return 'day';
  if (d <= 120) return 'week';
  return 'month';
}

export function bucketDate(d: Date, g: Granularity) {
  if (g === 'day') return startOfDay(d);
  if (g === 'week') return startOfWeek(d, { weekStartsOn: 1 });
  return startOfMonth(d);
}

export function formatBucket(d: Date, g: Granularity) {
  if (g === 'day') return format(d, 'd MMM');
  if (g === 'week') return format(d, "'W'w MMM");
  return format(d, 'MMM yy');
}

export function presetRange(preset: string): Range {
  const to = new Date();
  const from = new Date(to);
  switch (preset) {
    case '7d': from.setDate(to.getDate() - 7); break;
    case '30d': from.setDate(to.getDate() - 30); break;
    case '90d': from.setDate(to.getDate() - 90); break;
    case 'ytd': from.setMonth(0, 1); from.setHours(0, 0, 0, 0); break;
    case '12m': from.setFullYear(to.getFullYear() - 1); break;
    case 'all': from.setFullYear(2000, 0, 1); break;
    default: from.setDate(to.getDate() - 90);
  }
  return { from, to };
}
