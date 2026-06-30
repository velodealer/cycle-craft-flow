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
  const collectionCost = Number(bike.collection_cost ?? 0);
  const deliveryCost = Number(bike.delivery_cost ?? 0);
  const acquisition = Number(bike.purchase_cost ?? bike.purchase_price ?? 0);
  const prep = collectionCost + deliveryCost + partsCost + jobsCost;
  const totalCosts = acquisition + prep;
  const isSold = bike.status === 'sold';
  const revenue = Number((isSold ? bike.sale_price : bike.asking_price) || 0);
  const grossProfit = revenue - totalCosts;
  const isMargin = bike.finance_scheme === 'margin_scheme';
  const isVatQualifying = bike.finance_scheme === 'vat_qualifying';
  const vatOnMargin = isMargin ? Math.max(0, revenue - acquisition) * 20 / 120 : 0;
  const netProfit = grossProfit - vatOnMargin;
  const sharePct = Number(bike.profit_share_pct || 0);
  const myReturn = Math.max(0, netProfit) * (sharePct / 100);
  const siv = isMargin ? acquisition + prep * 1.2
            : isVatQualifying ? totalCosts * 1.2
            : totalCosts;
  const headroom = revenue - siv;

  const Row = ({ label, value, negative, bold, muted, sub }: { label: string; value: string; negative?: boolean; bold?: boolean; muted?: boolean; sub?: string }) => (
    <div className="flex justify-between items-baseline py-1.5 border-b last:border-b-0 text-sm">
      <span className={muted ? 'text-muted-foreground' : ''}>{label}{sub && <span className="block text-xs text-muted-foreground">{sub}</span>}</span>
      <span className={`${bold ? 'font-semibold text-base' : ''} ${negative ? 'text-destructive' : ''}`}>{value}</span>
    </div>
  );

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

      <Card>
        <CardHeader>
          <CardTitle>Cost & profit breakdown</CardTitle>
          <p className="text-xs text-muted-foreground">{isSold ? 'Realised — based on sale price' : 'Estimated — based on listed asking price'}</p>
        </CardHeader>
        <CardContent>
          <div className="space-y-0">
            <Row label={isSold ? 'Sale price' : 'Asking price'} value={fmt(revenue)} bold />
            <Row label="Acquisition cost" value={`− ${fmt(acquisition)}`} muted />
            <Row label="Collection cost" value={`− ${fmt(collectionCost)}`} muted />
            <Row label="Delivery cost" value={`− ${fmt(deliveryCost)}`} muted />
            <Row label="Parts" value={`− ${fmt(partsCost)}`} muted />
            <Row label="Labour / jobs" value={`− ${fmt(jobsCost)}`} muted />
            <Row label="Total costs" value={fmt(totalCosts)} bold />
            <Row label="Gross profit" value={fmt(grossProfit)} bold negative={grossProfit < 0} />
            {isMargin && (
              <Row label="VAT (margin scheme)" sub="20% VAT on gross margin paid to HMRC" value={`− ${fmt(vatOnMargin)}`} muted />
            )}
            <Row label="Net profit" value={fmt(netProfit)} bold negative={netProfit < 0} />
            <Row label={`Your share (${sharePct}%)`} value={fmt(myReturn)} bold />
          </div>

          <div className="mt-4 p-3 rounded-md border bg-muted/30 space-y-1">
            <div className="flex justify-between items-baseline">
              <div>
                <div className="text-sm font-semibold">Stand-In Value (break-even price)</div>
                <div className="text-xs text-muted-foreground">{sivExplain}</div>
              </div>
              <div className="text-lg font-semibold">{fmt(siv)}</div>
            </div>
            {revenue > 0 && (
              <div className="flex justify-between items-baseline text-sm pt-2 border-t">
                <span className="text-muted-foreground">Headroom vs SIV ({isSold ? 'sale' : 'asking'})</span>
                <span className={`font-medium ${headroom < 0 ? 'text-destructive' : ''}`}>{headroom >= 0 ? '+' : ''}{fmt(headroom)}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-3 gap-4">
        <Card><CardHeader><CardTitle>Total invested costs</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{fmt(totalCosts)}</CardContent></Card>
        <Card><CardHeader><CardTitle>Net profit</CardTitle></CardHeader><CardContent><div className={`text-2xl font-bold ${netProfit < 0 ? 'text-destructive' : ''}`}>{fmt(netProfit)}</div>{isMargin && <div className="text-xs text-muted-foreground">After {fmt(vatOnMargin)} VAT</div>}</CardContent></Card>
        <Card><CardHeader><CardTitle>Your return</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{fmt(myReturn)}</div><div className="text-xs text-muted-foreground">{sharePct}% of net {isSold ? '(realised)' : '(estimated)'}</div></CardContent></Card>
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
