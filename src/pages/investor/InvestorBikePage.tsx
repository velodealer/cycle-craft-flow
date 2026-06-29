import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';
import StatusProgressBar from '@/components/bike/StatusProgressBar';

const fmt = (n: number | null | undefined) => (n != null ? `£${Number(n).toFixed(2)}` : '-');
const dt = (s: string | null | undefined) => (s ? new Date(s).toLocaleDateString() : '-');

export default function InvestorBikePage() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const [bike, setBike] = useState<any>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [parts, setParts] = useState<any[]>([]);
  const [collections, setCollections] = useState<any[]>([]);
  const [fulfilment, setFulfilment] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const [b, j, p, c, f] = await Promise.all([
      supabase.from('bikes').select('*').eq('id', id).maybeSingle(),
      supabase.from('jobs').select('*').eq('bike_id', id).order('created_at', { ascending: true }),
      supabase.from('parts').select('*').eq('bike_id', id).order('created_at', { ascending: true }),
      supabase.from('bike_collections').select('*').eq('bike_id', id).order('created_at', { ascending: true }),
      supabase.from('fulfilment_events').select('*').eq('bike_id', id).order('created_at', { ascending: true }),
    ]);
    setBike(b.data);
    setJobs(j.data || []);
    setParts(p.data || []);
    setCollections(c.data || []);
    setFulfilment(f.data || []);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="container mx-auto py-6 space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64 w-full" /></div>;
  if (!bike) return <div className="container mx-auto py-6"><h1 className="text-2xl font-bold">Bike not found</h1><Button asChild className="mt-4"><Link to="/investor">Back</Link></Button></div>;

  // Guard: only show if this investor owns the bike (RLS should already enforce)
  if (profile?.user_id && bike.investor_id && bike.investor_id !== profile.user_id) {
    return <div className="container mx-auto py-6"><h1 className="text-2xl font-bold">Not authorised</h1></div>;
  }

  const partsCost = parts.reduce((s, p) => s + Number(p.cost_price ?? 0) * Number(p.quantity ?? 1), 0);
  const jobsCost = jobs.reduce((s, j) => s + Number(j.actual_cost ?? j.estimated_cost ?? 0), 0);
  const basis = bike.status === 'sold' ? bike.sale_price : bike.asking_price;
  const net = Number(basis || 0) - Number(bike.purchase_cost || 0) - partsCost - jobsCost;
  const myReturn = Math.max(0, net) * (Number(bike.profit_share_pct || 0) / 100);

  const timeline: Array<{ date: string; label: string }> = [];
  if (bike.intake_date) timeline.push({ date: bike.intake_date, label: 'Acquired' });
  collections.forEach((c) => c.created_at && timeline.push({ date: c.created_at, label: `Collection ${c.status || 'booked'}` }));
  jobs.forEach((j) => j.completed_at && timeline.push({ date: j.completed_at, label: `Job complete: ${j.title || j.type || ''}` }));
  fulfilment.forEach((e) => (e.timestamp || e.created_at) && timeline.push({ date: e.timestamp || e.created_at, label: e.stage ? `Stage: ${e.stage}` : 'Fulfilment event' }));
  timeline.sort((a, b) => +new Date(a.date) - +new Date(b.date));

  return (
    <div className="container mx-auto py-6 space-y-6">
      <Button variant="ghost" size="sm" asChild className="w-fit">
        <Link to="/investor"><ChevronLeft className="h-4 w-4 mr-2" />Back</Link>
      </Button>
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-3xl font-bold">{bike.make} {bike.model}</h1>
          <p className="text-muted-foreground text-sm">{bike.year && `${bike.year} • `}{bike.size || ''}</p>
        </div>
        <Badge variant="outline">{String(bike.status).replace(/_/g, ' ')}</Badge>
      </div>

      <StatusProgressBar currentStatus={bike.status} bikeId={bike.id} />

      <div className="grid md:grid-cols-3 gap-4">
        <Card><CardHeader><CardTitle>Purchase cost</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{fmt(bike.purchase_cost)}</CardContent></Card>
        <Card><CardHeader><CardTitle>Costs to date</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{fmt(partsCost + jobsCost)}</div><div className="text-xs text-muted-foreground">Parts {fmt(partsCost)} • Jobs {fmt(jobsCost)}</div></CardContent></Card>
        <Card><CardHeader><CardTitle>Your return</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{fmt(myReturn)}</div><div className="text-xs text-muted-foreground">{bike.profit_share_pct ?? 0}% of net {bike.status === 'sold' ? '(realised)' : '(estimated)'}</div></CardContent></Card>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>Activity timeline</CardTitle></CardHeader>
          <CardContent>
            {timeline.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity yet.</p>
            ) : (
              <ol className="space-y-3">
                {timeline.map((t, i) => (
                  <li key={i} className="flex justify-between text-sm border-b last:border-b-0 pb-2">
                    <span>{t.label}</span>
                    <span className="text-muted-foreground">{dt(t.date)}</span>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Listing</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Asking price</span><span>{fmt(bike.asking_price)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Sale price</span><span>{fmt(bike.sale_price)}</span></div>
            {bike.listing_description && (
              <div className="pt-2"><div className="text-muted-foreground mb-1">Description</div><p className="whitespace-pre-wrap">{bike.listing_description}</p></div>
            )}
          </CardContent>
        </Card>
      </div>

      {bike.photos && bike.photos.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Photos</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {bike.photos.map((p: string, i: number) => (
                <img key={i} src={p} alt={`${bike.make} ${bike.model} ${i + 1}`} className="w-full h-40 object-cover rounded-md border" />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
