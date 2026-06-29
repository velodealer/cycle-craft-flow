import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Bike, TrendingUp, Wallet, Package } from 'lucide-react';

interface InvestorBike {
  id: string;
  make: string;
  model: string;
  year: number | null;
  status: string;
  purchase_cost: number | null;
  purchase_price: number | null;
  collection_cost: number | null;
  delivery_cost: number | null;
  sale_price: number | null;
  asking_price: number | null;
  profit_share_pct: number | null;
  finance_scheme: string | null;
  intake_date: string | null;
  photos: string[] | null;
}

const fmt = (n: number | null | undefined) => (n != null ? `£${Number(n).toFixed(2)}` : '-');

export default function InvestorDashboardPage() {
  const { profile } = useAuth();
  const [bikes, setBikes] = useState<InvestorBike[]>([]);
  const [costsByBike, setCostsByBike] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.user_id) return;
    (async () => {
      setLoading(true);
      const { data: bikeData } = await supabase
        .from('bikes')
        .select('id, make, model, year, status, purchase_cost, purchase_price, collection_cost, delivery_cost, sale_price, asking_price, profit_share_pct, finance_scheme, intake_date, photos')
        .eq('investor_id', profile.user_id)
        .order('intake_date', { ascending: false });

      const list = (bikeData || []) as InvestorBike[];
      setBikes(list);

      if (list.length > 0) {
        const ids = list.map((b) => b.id);
        const [{ data: jobs }, { data: parts }] = await Promise.all([
          supabase.from('jobs').select('bike_id, actual_cost, estimated_cost').in('bike_id', ids),
          supabase.from('parts').select('bike_id, cost_price, quantity').in('bike_id', ids),
        ]);
        const totals: Record<string, number> = {};
        (jobs || []).forEach((j: any) => { if (j.bike_id) totals[j.bike_id] = (totals[j.bike_id] || 0) + Number(j.actual_cost ?? j.estimated_cost ?? 0); });
        (parts || []).forEach((p: any) => { if (p.bike_id) totals[p.bike_id] = (totals[p.bike_id] || 0) + Number(p.cost_price ?? 0) * Number(p.quantity ?? 1); });
        setCostsByBike(totals);
      }
      setLoading(false);
    })();
  }, [profile?.user_id]);

  const computeBike = (b: InvestorBike) => {
    const acquisition = Number(b.purchase_cost ?? b.purchase_price ?? 0);
    const extras = Number(b.collection_cost ?? 0) + Number(b.delivery_cost ?? 0) + (costsByBike[b.id] || 0);
    const totalCosts = acquisition + extras;
    const isSold = b.status === 'sold';
    const revenue = Number((isSold ? b.sale_price : b.asking_price) || 0);
    const gross = revenue - totalCosts;
    const vat = b.finance_scheme === 'margin_scheme' ? Math.max(0, gross) * 20 / 120 : 0;
    const net = gross - vat;
    const myReturn = Math.max(0, net) * (Number(b.profit_share_pct || 0) / 100);
    return { acquisition, totalCosts, revenue, gross, vat, net, myReturn, isSold };
  };

  const totalInvested = bikes.reduce((s, b) => s + Number(b.purchase_cost ?? b.purchase_price ?? 0), 0);
  const sold = bikes.filter((b) => b.status === 'sold');
  const active = bikes.filter((b) => b.status !== 'sold');
  const realisedReturn = sold.reduce((s, b) => s + computeBike(b).myReturn, 0);
  const unrealisedReturn = active.reduce((s, b) => s + computeBike(b).myReturn, 0);

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">My Investments</h1>
        <p className="text-muted-foreground">Track the bikes you've funded and your returns.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<Bike className="h-4 w-4" />} label="Bikes" value={loading ? '…' : bikes.length.toString()} />
        <StatCard icon={<Package className="h-4 w-4" />} label="Active" value={loading ? '…' : `${active.length}`} />
        <StatCard icon={<Wallet className="h-4 w-4" />} label="Total invested" value={loading ? '…' : fmt(totalInvested)} />
        <StatCard icon={<TrendingUp className="h-4 w-4" />} label="Returns (realised)" value={loading ? '…' : fmt(realisedReturn)} sub={`+ ${fmt(unrealisedReturn)} est.`} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your bikes</CardTitle>
          <p className="text-xs text-muted-foreground">All costs (acquisition, collection, delivery, parts, labour) and margin-scheme VAT are deducted before your share is calculated.</p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div>
          ) : bikes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">You don't have any invested bikes yet.</p>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bike</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead>Acquisition</TableHead>
                    <TableHead>Collection</TableHead>
                    <TableHead>Delivery</TableHead>
                    <TableHead>Parts + Jobs</TableHead>
                    <TableHead>Total costs</TableHead>
                    <TableHead>Sale / Listed</TableHead>
                    <TableHead>VAT (margin)</TableHead>
                    <TableHead>Net profit</TableHead>
                    <TableHead>Your share</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bikes.map((b) => {
                    const c = computeBike(b);
                    const partsJobs = costsByBike[b.id] || 0;
                    return (
                      <TableRow key={b.id}>
                        <TableCell>
                          <div className="font-medium">{b.make} {b.model}</div>
                          {b.year && <div className="text-xs text-muted-foreground">{b.year}</div>}
                        </TableCell>
                        <TableCell><Badge variant="outline">{b.status.replace(/_/g, ' ')}</Badge></TableCell>
                        <TableCell>{fmt(c.acquisition)}</TableCell>
                        <TableCell>{fmt(b.collection_cost)}</TableCell>
                        <TableCell>{fmt(b.delivery_cost)}</TableCell>
                        <TableCell>{fmt(partsJobs)}</TableCell>
                        <TableCell className="font-medium">{fmt(c.totalCosts)}</TableCell>
                        <TableCell>{fmt(c.revenue)}</TableCell>
                        <TableCell>{c.vat > 0 ? fmt(c.vat) : '-'}</TableCell>
                        <TableCell className={c.net < 0 ? 'text-destructive' : ''}>{fmt(c.net)}</TableCell>
                        <TableCell>
                          <div className="font-medium">{fmt(c.myReturn)}</div>
                          <div className="text-xs text-muted-foreground">{b.profit_share_pct ?? 0}% {c.isSold ? 'realised' : 'est.'}</div>
                        </TableCell>
                        <TableCell>
                          <Link to={`/investor/bikes/${b.id}`} className="text-sm text-primary hover:underline">View</Link>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wide">{icon}{label}</div>
        <div className="text-2xl font-bold mt-1">{value}</div>
        {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );
}
