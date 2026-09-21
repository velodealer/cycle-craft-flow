import { supabase } from '@/integrations/supabase/client';

export type ActivityKind =
  | 'status_change'
  | 'price_change'
  | 'listing'
  | 'sale'
  | 'job'
  | 'part'
  | 'cost'
  | 'inspection'
  | 'logistics'
  | 'photo'
  | 'detail_change'
  | 'storage'
  | 'bike';

export const MONEY_KINDS: ActivityKind[] = ['price_change', 'sale', 'cost'];

export interface ActivityEntry {
  kind: ActivityKind;
  action: string;
  summary: string;
  detail?: Record<string, unknown>;
  actorId?: string | null;
  actorLabel?: string | null;
}

/**
 * Fire-and-forget activity logging. Never throws and never blocks the caller —
 * a failed log must not break the action it is recording.
 */
export function logActivity(bikeId: string, entry: ActivityEntry): void {
  void (async () => {
    try {
      const { error } = await supabase.from('bike_activity').insert({
        bike_id: bikeId,
        kind: entry.kind,
        action: entry.action,
        summary: entry.summary,
        detail: (entry.detail ?? {}) as any,
        actor_id: entry.actorId ?? null,
        actor_label: entry.actorLabel ?? null,
      } as any);
      if (error) console.error('Failed to log bike activity', error);
    } catch (e) {
      console.error('Failed to log bike activity', e);
    }
  })();
}

const gbp = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  maximumFractionDigits: 2,
});

export const money = (value: number | null | undefined) =>
  value == null ? 'not set' : gbp.format(Number(value));

/** Builds a "X changed from A to B" summary for a set of price fields. */
export function priceChangeSummaries(
  before: Record<string, number | null | undefined>,
  after: Record<string, number | null | undefined>,
  labels: Record<string, string>,
): { field: string; summary: string; from: number | null; to: number | null }[] {
  const out: { field: string; summary: string; from: number | null; to: number | null }[] = [];
  for (const field of Object.keys(labels)) {
    const from = before[field] ?? null;
    const to = after[field] ?? null;
    if (Number(from ?? NaN) === Number(to ?? NaN) || (from == null && to == null)) continue;
    out.push({
      field,
      from: from == null ? null : Number(from),
      to: to == null ? null : Number(to),
      summary: `${labels[field]} changed from ${money(from)} to ${money(to)}`,
    });
  }
  return out;
}
