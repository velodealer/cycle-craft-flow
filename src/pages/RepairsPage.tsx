import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { bikeRef } from '@/lib/bikeReference';
import BikeThumbnail from '@/components/bike/BikeThumbnail';
import BikeCostBreakdown from '@/components/bike/BikeCostBreakdown';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { PageHeader, EmptyState, Panel } from '@/components/velo/PageShell';
import { StageFlap } from '@/components/velo/StageFlap';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertTriangle, Check, PoundSterling, Undo2, Wrench, X } from 'lucide-react';

const fmt = (n: number | null | undefined) => `£${Number(n ?? 0).toFixed(2)}`;

const STATUS_LABEL: Record<string, string> = {
  reported: 'Awaiting approval',
  approved: 'Approved',
  declined: 'Declined',
  awaiting_part: 'Awaiting part',
  repaired: 'Repaired',
};

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  reported: 'destructive',
  approved: 'default',
  declined: 'outline',
  awaiting_part: 'secondary',
  repaired: 'default',
};

type Filter = 'pending' | 'torepair' | 'open' | 'all';

const FILTER_STATUSES: Record<Filter, string[] | null> = {
  pending: ['reported'],
  torepair: ['approved', 'awaiting_part'],
  open: ['reported', 'approved', 'awaiting_part'],
  all: null,
};

export default function RepairsPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const canDecide = !!profile && ['admin', 'owner'].includes(profile.role);
  const isMechanic = profile?.role === 'mechanic';

  const [filter, setFilter] = useState<Filter>(isMechanic ? 'torepair' : 'all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [faults, setFaults] = useState<any[]>([]);
  const [bikes, setBikes] = useState<Record<string, any>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const [costBike, setCostBike] = useState<any | null>(null);
  const [costTotals, setCostTotals] = useState<{ parts: number; jobs: number; stripped: number } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('inspection_faults').select('*').order('created_at');
    const statuses = FILTER_STATUSES[filter];
    if (statuses) query = query.in('status', statuses);
    const { data: faultRows } = await query;
    const rows = faultRows || [];
    setFaults(rows);

    const ids = Array.from(new Set(rows.map((f: any) => f.bike_id).filter(Boolean)));
    if (ids.length) {
      const { data: bikeRows } = await supabase
        .from('bikes')
        .select('id, reference, make, model, year, size, colour, status, photos, storage_bay_id, purchase_price, purchase_cost, collection_cost, delivery_cost, asking_price, sale_price, finance_scheme, source, profit_share_pct')
        .in('id', ids);
      const map: Record<string, any> = {};
      (bikeRows || []).forEach((b: any) => { map[b.id] = b; });
      setBikes(map);
    } else {
      setBikes({});
    }
    setLoading(false);
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => { if (isMechanic) setFilter('torepair'); }, [isMechanic]);

  const groups = useMemo(() => {
    const term = search.trim().toLowerCase();
    const byBike = new Map<string, any[]>();
    faults.forEach((f) => {
      const list = byBike.get(f.bike_id) || [];
      list.push(f);
      byBike.set(f.bike_id, list);
    });
    return Array.from(byBike.entries())
      .map(([bikeId, list]) => ({ bike: bikes[bikeId], bikeId, faults: list }))
      .filter((g) => {
        if (!g.bike) return false;
        if (!term) return true;
        const hay = [bikeRef(g.bike), g.bike.make, g.bike.model, g.bike.colour, g.bike.size]
          .filter(Boolean).join(' ').toLowerCase();
        return hay.includes(term);
      })
      .sort((a, b) => bikeRef(a.bike).localeCompare(bikeRef(b.bike)));
  }, [faults, bikes, search]);

  const decide = async (fault: any, decision: 'approved' | 'declined') => {
    setBusy(fault.id);
    try {
      const { data, error } = await supabase.functions.invoke('inspectabike-decision', {
        body: { fault_row_id: fault.id, decision, note: notes[fault.id] || undefined },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast({
        title: decision === 'approved' ? 'Repair approved' : 'Repair declined',
        description: decision === 'approved'
          ? 'Parts and labour costs added to this bike.'
          : 'No work will be carried out for this fault.',
      });
      await load();
    } catch (e: any) {
      toast({ title: 'Could not send decision', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  const completeOne = async (fault: any) => {
    const { data, error } = await supabase.functions.invoke('inspectabike-complete-repair', {
      body: { fault_row_id: fault.id },
    });
    if (error) throw error;
    if ((data as any)?.error) throw new Error((data as any).error);
  };

  const markRepaired = async (fault: any) => {
    setBusy(fault.id);
    try {
      await completeOne(fault);
      toast({ title: 'Repair marked as done', description: 'InspectABike has been updated too.' });
      await load();
    } catch (e: any) {
      toast({
        title: 'Could not record this repair',
        description: e.message || 'Nothing was changed. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setBusy(null);
    }
  };

  const markAllRepaired = async (bikeId: string, list: any[]) => {
    const outstanding = list.filter((f) => ['approved', 'awaiting_part'].includes(f.status));
    if (!outstanding.length) return;
    if (!window.confirm(`Mark all ${outstanding.length} repairs on this bike as done?`)) return;
    setBusy(`bike:${bikeId}`);
    let done = 0;
    let failed = 0;
    for (const f of outstanding) {
      try { await completeOne(f); done++; } catch { failed++; }
    }
    setBusy(null);
    await load();
    toast({
      title: failed ? `${done} of ${outstanding.length} recorded` : 'All repairs marked as done',
      description: failed ? `${failed} could not be recorded and are unchanged.` : 'InspectABike has been updated too.',
      variant: failed ? 'destructive' : undefined,
    });
  };


  const undo = async (fault: any) => {
    setBusy(fault.id);
    try {
      const { data, error } = await supabase.functions.invoke('inspectabike-undo-decision', {
        body: { fault_row_id: fault.id },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast({
        title: 'Decision undone',
        description: 'The repair is back to awaiting approval and any costs added were removed.',
      });
      await load();
    } catch (e: any) {
      toast({ title: 'Could not undo decision', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  const openCosting = async (bike: any) => {
    setCostBike(bike);
    setCostTotals(null);
    const [p, j] = await Promise.all([
      supabase.from('parts').select('cost_price, quantity, bike_id, stripped_from_bike_id').eq('bike_id', bike.id),
      supabase.from('jobs').select('actual_cost, estimated_cost').eq('bike_id', bike.id),
    ]);
    const parts = (p.data || []).reduce((s: number, r: any) => s + Number(r.cost_price || 0) * Number(r.quantity ?? 1), 0);
    const jobs = (j.data || []).reduce((s: number, r: any) => s + Number(r.actual_cost ?? r.estimated_cost ?? 0), 0);
    const { data: stripped } = await supabase
      .from('parts')
      .select('cost_price, quantity')
      .eq('stripped_from_bike_id', bike.id)
      .is('bike_id', null);
    const strippedValue = (stripped || []).reduce((s: number, r: any) => s + Number(r.cost_price || 0) * Number(r.quantity ?? 1), 0);
    setCostTotals({ parts, jobs, stripped: strippedValue });
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title={isMechanic ? 'Repairs' : 'Repairs approval'}
        density="bench"
        description={
          isMechanic
            ? 'Approved repairs to carry out, grouped by bike.'
            : 'Inspection faults grouped by bike, with parts and labour costs.'
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
        <Input
          className="sm:max-w-xs"
          placeholder="Filter by bike ID, make or model"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : groups.length === 0 ? (
        <Panel bodyClassName="p-0">
          <EmptyState
            fact="No repairs to show."
            fix="Faults appear here once a bike has been inspected."
          />
        </Panel>
      ) : (
        <div className="space-y-4">
          {groups.map(({ bike, bikeId, faults: list }) => {
            const pendingTotal = list
              .filter((f) => f.status === 'reported')
              .reduce((s, f) => s + Number(f.parts_cost || 0) + Number(f.labour_cost || 0), 0);
            const approvedTotal = list
              .filter((f) => ['approved', 'awaiting_part', 'repaired'].includes(f.status))
              .reduce((s, f) => s + Number(f.parts_cost || 0) + Number(f.labour_cost || 0), 0);
            const pendingCount = list.filter((f) => f.status === 'reported').length;
            const toRepairCount = list.filter((f) => ['approved', 'awaiting_part'].includes(f.status)).length;

            return (
              <Card key={bikeId}>
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-start gap-3">
                    <BikeThumbnail photos={bike.photos} alt={`${bike.make} ${bike.model}`} />
                    <div className="min-w-0 flex-1">
                      <button
                        className="text-left font-semibold hover:underline break-words"
                        onClick={() => navigate(`/bikes/${bikeId}`)}
                      >
                        {bike.make} {bike.model} {bike.year || ''}
                      </button>
                      <p className="id-text text-xs text-muted-foreground">{bikeRef(bike)}</p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        <StageFlap stage={bike.status} size="sm" />
                        {bike.size && <Badge variant="outline">{bike.size}</Badge>}
                        {bike.colour && <Badge variant="outline">{bike.colour}</Badge>}
                        {pendingCount > 0 && (
                          <Badge variant="destructive">
                            <AlertTriangle className="h-3 w-3 mr-1" />{pendingCount} awaiting approval
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {!isMechanic && (
                        <Button size={isMechanic ? 'bench' : 'sm'} variant="outline" onClick={() => openCosting(bike)}>
                          <PoundSterling className="h-4 w-4 mr-1" />View costing
                        </Button>
                      )}
                      {toRepairCount > 0 && (
                        <Button
                          size={isMechanic ? 'bench' : 'sm'}
                          disabled={busy === `bike:${bikeId}`}
                          onClick={() => markAllRepaired(bikeId, list)}
                        >
                          <Wrench className="h-4 w-4 mr-1" />Mark all repaired ({toRepairCount})
                        </Button>
                      )}
                    </div>
                  </div>
                  {!isMechanic && (
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm pt-2">
                      <span>Awaiting approval: <strong>{fmt(pendingTotal)}</strong></span>
                      <span>Approved work: <strong>{fmt(approvedTotal)}</strong></span>
                    </div>
                  )}
                </CardHeader>

                <CardContent className="space-y-3">
                  {list.map((f) => (
                    <div key={f.id} className="rounded-[4px] border border-border p-3 space-y-2">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium break-words">{f.title}</p>
                          {f.component && <p className="text-xs text-muted-foreground">{f.component}</p>}
                        </div>
                        <Badge variant={STATUS_VARIANT[f.status] || 'secondary'}>
                          {STATUS_LABEL[f.status] || f.status}
                        </Badge>
                      </div>

                      {f.description && (
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{f.description}</p>
                      )}

                      {!isMechanic && (
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                          <span>Parts: <strong>{fmt(f.parts_cost)}</strong></span>
                          <span>Labour: <strong>{fmt(f.labour_cost)}</strong></span>
                          <span>Total: <strong>{fmt(Number(f.parts_cost || 0) + Number(f.labour_cost || 0))}</strong></span>
                        </div>
                      )}

                      {f.decision_note && (
                        <p className="text-xs text-muted-foreground">Note: {f.decision_note}</p>
                      )}

                      {f.status === 'repaired' && f.repaired_at && (
                        <p className="text-xs text-muted-foreground">
                          Repair completed {new Date(f.repaired_at).toLocaleString()}
                        </p>
                      )}

                      {canDecide && f.status === 'reported' && (
                        <div className="flex flex-col sm:flex-row gap-2">
                          <Input
                            placeholder="Optional note"
                            value={notes[f.id] || ''}
                            onChange={(e) => setNotes((n) => ({ ...n, [f.id]: e.target.value }))}
                          />
                          <div className="flex gap-2">
                            <Button size="sm" disabled={busy === f.id} onClick={() => decide(f, 'approved')}>
                              <Check className="h-4 w-4 mr-1" />Approve
                            </Button>
                            <Button size="sm" variant="outline" disabled={busy === f.id} onClick={() => decide(f, 'declined')}>
                              <X className="h-4 w-4 mr-1" />Decline
                            </Button>
                          </div>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2">
                        {['approved', 'awaiting_part'].includes(f.status) && (
                          <Button size="sm" disabled={busy === f.id} onClick={() => markRepaired(f)}>
                            <Wrench className="h-4 w-4 mr-1" />Mark repaired
                          </Button>
                        )}
                        {canDecide && ['approved', 'declined', 'awaiting_part'].includes(f.status) && (
                          <Button size="sm" variant="ghost" disabled={busy === f.id} onClick={() => undo(f)}>
                            <Undo2 className="h-4 w-4 mr-1" />Undo decision
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!costBike} onOpenChange={(open) => { if (!open) { setCostBike(null); setCostTotals(null); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {costBike ? `${costBike.make} ${costBike.model} — ${bikeRef(costBike)}` : 'Costing'}
            </DialogTitle>
          </DialogHeader>
          {costBike && (costTotals ? (
            <BikeCostBreakdown
              bike={costBike}
              partsCost={costTotals.parts}
              jobsCost={costTotals.jobs}
              strippedInventoryValue={costTotals.stripped}
            />
          ) : (
            <Skeleton className="h-48 w-full" />
          ))}
        </DialogContent>
      </Dialog>
    </div>
  );
}
