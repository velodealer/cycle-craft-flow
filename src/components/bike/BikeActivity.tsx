import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { History } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { MONEY_KINDS, type ActivityKind } from '@/lib/activity';

interface ActivityRow {
  id: string;
  kind: string;
  action: string;
  summary: string;
  detail: any;
  actor_id: string | null;
  actor_label: string | null;
  created_at: string;
}

interface BikeActivityProps {
  bikeId: string;
  canSeePricing?: boolean;
}

const FILTERS: { key: string; label: string; kinds: string[] }[] = [
  { key: 'all', label: 'All', kinds: [] },
  { key: 'status', label: 'Status', kinds: ['status_change', 'bike'] },
  { key: 'money', label: 'Money', kinds: ['price_change', 'sale', 'cost'] },
  { key: 'listings', label: 'Listings', kinds: ['listing'] },
  { key: 'workshop', label: 'Workshop', kinds: ['job', 'part', 'inspection', 'photo', 'detail_change'] },
  { key: 'logistics', label: 'Logistics', kinds: ['logistics', 'storage'] },
];

const KIND_LABEL: Record<string, string> = {
  status_change: 'Status',
  price_change: 'Pricing',
  listing: 'Listing',
  sale: 'Sale',
  job: 'Job',
  part: 'Parts',
  cost: 'Cost',
  inspection: 'Inspection',
  logistics: 'Logistics',
  photo: 'Photos',
  detail_change: 'Details',
  storage: 'Storage',
  bike: 'Bike',
};

const PAGE = 15;

export default function BikeActivity({ bikeId, canSeePricing = true }: BikeActivityProps) {
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);

    const [{ data: activity }, { data: legacy }] = await Promise.all([
      supabase
        .from('bike_activity')
        .select('id, kind, action, summary, detail, actor_id, actor_label, created_at')
        .eq('bike_id', bikeId)
        .order('created_at', { ascending: false }),
      supabase
        .from('fulfilment_events')
        .select('id, stage, notes, timestamp, performed_by')
        .eq('bike_id', bikeId)
        .order('timestamp', { ascending: false }),
    ]);

    const legacyRows: ActivityRow[] = ((legacy || []) as any[]).map((e) => ({
      id: `legacy-${e.id}`,
      kind: 'status_change',
      action: 'stage',
      summary: `Moved to ${String(e.stage).replace(/_/g, ' ')}`,
      detail: e.notes ? { note: e.notes } : {},
      actor_id: e.performed_by ?? null,
      actor_label: null,
      created_at: e.timestamp,
    }));

    const all = [...((activity || []) as ActivityRow[]), ...legacyRows].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
    setRows(all);

    const ids = Array.from(new Set(all.map((r) => r.actor_id).filter(Boolean))) as string[];
    if (ids.length) {
      const { data: profiles } = await supabase.from('profiles').select('id, name').in('id', ids);
      setNames(Object.fromEntries((profiles || []).map((p: any) => [p.id, p.name])));
    }
    setLoading(false);
  }, [bikeId]);

  useEffect(() => {
    load();
  }, [load]);

  const visible = useMemo(() => {
    let list = rows;
    if (!canSeePricing) list = list.filter((r) => !MONEY_KINDS.includes(r.kind as ActivityKind));
    const f = FILTERS.find((x) => x.key === filter);
    if (f && f.kinds.length) list = list.filter((r) => f.kinds.includes(r.kind));
    return list;
  }, [rows, filter, canSeePricing]);

  if (loading || rows.length === 0) return null;

  const shown = showAll ? visible : visible.slice(0, PAGE);

  return (
    <Card>
      <CardHeader className="space-y-3">
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Activity
        </CardTitle>
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.filter((f) => canSeePricing || f.key !== 'money').map((f) => (
            <Button
              key={f.key}
              size="sm"
              variant={filter === f.key ? 'default' : 'outline'}
              className="h-7 px-2.5 text-xs"
              onClick={() => {
                setFilter(f.key);
                setShowAll(false);
              }}
            >
              {f.label}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {shown.length === 0 && (
          <p className="text-sm text-muted-foreground">Nothing recorded in this category yet.</p>
        )}
        {shown.map((row) => {
          const who = row.actor_id ? names[row.actor_id] : row.actor_label;
          const note = row.detail?.note as string | undefined;
          return (
            <div key={row.id} className="border-l-2 border-muted pl-3 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{KIND_LABEL[row.kind] ?? row.kind}</Badge>
                <span className="text-xs text-muted-foreground">
                  {new Date(row.created_at).toLocaleString()}
                  {who ? ` • ${who}` : ''}
                </span>
              </div>
              <p className="text-sm">{row.summary}</p>
              {note && <p className="text-sm text-muted-foreground whitespace-pre-wrap">{note}</p>}
            </div>
          );
        })}
        {visible.length > shown.length && (
          <Button variant="outline" size="sm" onClick={() => setShowAll(true)}>
            Show all {visible.length}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
