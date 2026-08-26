import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { History } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface StageEvent {
  id: string;
  stage: string;
  notes: string | null;
  timestamp: string;
  performed_by: string;
}

interface StageHistoryProps {
  bikeId: string;
}

export default function StageHistory({ bikeId }: StageHistoryProps) {
  const [events, setEvents] = useState<StageEvent[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('fulfilment_events')
      .select('id, stage, notes, timestamp, performed_by')
      .eq('bike_id', bikeId)
      .order('timestamp', { ascending: false });

    const list = (data || []) as StageEvent[];
    setEvents(list);

    const ids = Array.from(new Set(list.map((e) => e.performed_by).filter(Boolean)));
    if (ids.length) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', ids);
      setNames(Object.fromEntries((profiles || []).map((p: any) => [p.id, p.name])));
    }
    setLoading(false);
  }, [bikeId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading || events.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Stage History
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {events.map((event) => (
          <div key={event.id} className="border-l-2 border-muted pl-3 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="capitalize">
                {event.stage.replace(/_/g, ' ')}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {new Date(event.timestamp).toLocaleString()}
                {names[event.performed_by] ? ` • ${names[event.performed_by]}` : ''}
              </span>
            </div>
            {event.notes && (
              <p className="text-sm whitespace-pre-wrap">{event.notes}</p>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
