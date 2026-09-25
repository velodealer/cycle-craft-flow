import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { bikeRef } from '@/lib/bikeReference';
import BikeThumbnail from '@/components/bike/BikeThumbnail';
import BikeCostBreakdown from '@/components/bike/BikeCostBreakdown';
import WorkshopBikeCard from '@/components/velo/WorkshopBikeCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageHeader, EmptyState, Panel } from '@/components/velo/PageShell';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertTriangle, Check, PoundSterling, Undo2, X } from 'lucide-react';
import { useStorageBays } from '@/hooks/useStorageBays';

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

export default function RepairsPage() {
  const { profile } = useAuth();
  const canDecide = !!profile && ['admin', 'owner'].includes(profile.role);
  const { bays } = useStorageBays();
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
    const { data: faultRows } = await supabase.from('inspection_faults').select('*').order('created_at');
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
  }, []);

  useEffect(() => { load(); }, [load]);

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
        if (!g.faults.some((fault) => fault.status === 'reported')) return false;
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

  const bayName = (id: string | null | undefined) => {
    if (!id) return null;
    const bay = bays.find((item) => item.id === id);
    return bay ? (bay.zone ? `${bay.zone} · ${bay.name}` : bay.name) : null;
  };

  if (profile && !canDecide) {
    return <Panel><EmptyState fact="You do not have access to repair approvals." /></Panel>;
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Repairs approval"
        density="bench"
        description="Inspection repairs awaiting an owner or admin decision, grouped by bike."
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

            return (
              <WorkshopBikeCard
                key={bikeId}
                bike={bike}
                location={bayName(bike.storage_bay_id)}
                badges={<Badge variant="destructive"><AlertTriangle className="mr-1 h-3 w-3" />{pendingCount} awaiting approval</Badge>}
                actions={<Button size="sm" variant="outline" onClick={() => openCosting(bike)}><PoundSterling className="mr-1 h-4 w-4" />View costing</Button>}
                summary={<div className="flex flex-wrap gap-x-4 gap-y-1 pt-2 text-sm"><span>Awaiting approval: <strong>{fmt(pendingTotal)}</strong></span><span>Approved work: <strong>{fmt(approvedTotal)}</strong></span></div>}
              >
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

                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                        <span>Parts: <strong>{fmt(f.parts_cost)}</strong></span>
                        <span>Labour: <strong>{fmt(f.labour_cost)}</strong></span>
                        <span>Total: <strong>{fmt(Number(f.parts_cost || 0) + Number(f.labour_cost || 0))}</strong></span>
                      </div>

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
                        {canDecide && ['approved', 'declined', 'awaiting_part'].includes(f.status) && (
                          <Button size="sm" variant="ghost" disabled={busy === f.id} onClick={() => undo(f)}>
                            <Undo2 className="h-4 w-4 mr-1" />Undo decision
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
              </WorkshopBikeCard>
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
