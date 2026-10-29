import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Camera, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { bikeRef } from '@/lib/bikeReference';

const GUIDED_TOTAL = 18;

export default function AwaitingPhotosPage() {
  const [bikes, setBikes] = useState<any[] | null>(null);
  const [done, setDone] = useState<Record<string, number>>({});

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('bikes')
        .select('id, reference, make, model, year, colour, size, updated_at')
        .eq('status', 'photos' as any).order('updated_at', { ascending: true });
      const list = data ?? [];
      setBikes(list);
      if (!list.length) return;
      const { data: rows } = await supabase.from('bike_photos' as any)
        .select('bike_id, shot_number').in('bike_id', list.map((b: any) => b.id));
      const counts: Record<string, number> = {};
      for (const r of (rows as any[]) ?? []) if (r.shot_number <= GUIDED_TOTAL) counts[r.bike_id] = (counts[r.bike_id] || 0) + 1;
      setDone(counts);
    })();
  }, []);

  return (
    <div className="container mx-auto max-w-4xl space-y-4 py-4">
      <div>
        <h1 className="text-xl font-semibold">Awaiting photos</h1>
        <p className="text-sm text-muted-foreground">Bikes that have finished workshop and need their 18 guided photos before listing.</p>
      </div>
      {!bikes ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : !bikes.length ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">No bikes are waiting for photos.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {bikes.map((b) => {
            const n = Math.min(done[b.id] ?? 0, GUIDED_TOTAL);
            return (
              <Card key={b.id}>
                <CardContent className="flex flex-wrap items-center gap-3 p-3">
                  <Link to={`/bikes/${b.id}`} className="min-w-0 flex-1">
                    <div className="truncate font-medium">{[b.year, b.make, b.model].filter(Boolean).join(' ') || 'Bike'}</div>
                    <div className="text-xs text-muted-foreground">{bikeRef(b)}{b.size ? ` · ${b.size}` : ''}{b.colour ? ` · ${b.colour}` : ''}</div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <Progress value={(n / GUIDED_TOTAL) * 100} className="h-1.5 max-w-40" />
                      <span className="text-xs tabular-nums text-muted-foreground">{n}/{GUIDED_TOTAL}</span>
                    </div>
                  </Link>
                  <Button asChild size="sm">
                    <Link to={`/bikes/${b.id}/photos`}><Camera className="mr-1.5 h-4 w-4" />{n ? 'Continue' : 'Take photos'}</Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
