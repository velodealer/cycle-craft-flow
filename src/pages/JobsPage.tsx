import { useEffect, useMemo, useState } from 'react';
import { useStorageBays } from '@/hooks/useStorageBays';
import { supabase } from '@/integrations/supabase/client';
import { functionErrorMessage } from '@/services/inspectabike';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmptyState, PageHeader, Panel } from '@/components/velo/PageShell';
import WorkshopBikeCard from '@/components/velo/WorkshopBikeCard';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { logActivity, money } from '@/lib/activity';

interface JobRow {
  id: string;
  title: string;
  type: string;
  status: string;
  description: string | null;
  assigned_to: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  estimated_cost: number | null;
  actual_cost: number | null;
  bike_id: string;
  bikes: { id: string; make: string; model: string; year: number | null; size: string | null; colour: string | null; status: string; photos: string[] | null; reference: string | null; storage_bay_id: string | null } | null;
}

const FILTERS = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'complete', label: 'Done' },
  { value: 'all', label: 'All' },
];

const isDone = (status: string) => status === 'complete' || status === 'completed';
const isClosed = (status: string) => isDone(status) || status === 'cancelled';

const statusLabel = (status: string) =>
  isDone(status) ? 'Done' : status === 'in_progress' ? 'In progress' : 'Pending';

const formatDate = (value: string | null) =>
  value ? new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '—';

export default function JobsPage() {
  const { profile } = useAuth();
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('open');
  const [busyId, setBusyId] = useState<string | null>(null);
  const { bays } = useStorageBays();

  const bayName = (id: string | null) => {
    if (!id) return null;
    const bay = bays.find((b) => b.id === id);
    return bay ? (bay.zone ? `${bay.zone} · ${bay.name}` : bay.name) : null;
  };

  const load = async () => {
    const { data, error } = await supabase
      .from('jobs')
      .select(
        'id, title, type, status, description, assigned_to, started_at, completed_at, created_at, estimated_cost, actual_cost, bike_id, bikes(id, make, model, year, size, colour, status, photos, reference, storage_bay_id)',
      )
      .eq('type', 'workshop')
      .order('created_at', { ascending: false });
    if (error) {
      toast.error('Could not load jobs.');
    } else {
      const rows = (data as unknown as JobRow[]) ?? [];
      const bikeIds = Array.from(new Set(rows.map((job) => job.bike_id).filter(Boolean)));
      let blockedBikeIds = new Set<string>();
      if (bikeIds.length) {
        const { data: pendingFaults, error: faultError } = await supabase
          .from('inspection_faults')
          .select('bike_id')
          .in('bike_id', bikeIds)
          .eq('status', 'reported');
        if (faultError) toast.error('Could not check repair approvals.');
        else blockedBikeIds = new Set((pendingFaults || []).map((fault) => fault.bike_id));
      }
      setJobs(rows.filter((job) => !blockedBikeIds.has(job.bike_id)));
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const visible = useMemo(() => {
    if (filter === 'all') return jobs;
    if (filter === 'open') return jobs.filter((j) => !isClosed(j.status));
    if (filter === 'complete') return jobs.filter((j) => isDone(j.status));
    return jobs.filter((j) => j.status === filter);
  }, [jobs, filter]);

  const groups = useMemo(() => {
    const map = new Map<string, JobRow[]>();
    for (const j of visible) map.set(j.bike_id, [...(map.get(j.bike_id) ?? []), j]);
    return Array.from(map.values());
  }, [visible]);

  const update = async (job: JobRow, patch: Record<string, unknown>) => {
    setBusyId(job.id);
    const nextStatus = patch.status as string | undefined;

    // A job belonging to an InspectABike fault is only "done" once InspectABike
    // accepts it — that call also repairs the fault, completes the job and
    // advances the bike, so nothing is written locally before it agrees.
    if (nextStatus && isDone(nextStatus)) {
      const { data: openFault } = await supabase
        .from('inspection_faults')
        .select('id')
        .eq('job_id', job.id)
        .not('status', 'in', '(repaired,declined)')
        .maybeSingle();
      if (openFault) {
        const { error: fnError, data: fnData } = await supabase.functions.invoke(
          'inspectabike-complete-repair',
          { body: { fault_row_id: (openFault as { id: string }).id } },
        );
        setBusyId(null);
        if (fnError || (fnData as { error?: string } | null)?.error) {
          toast.error(await functionErrorMessage(fnError, fnData));
          return;
        }
        logActivity(job.bike_id, {
          kind: 'job',
          action: 'complete',
          summary: `Job completed: ${job.title} (marked repaired on InspectABike)`,
          detail: { job_id: job.id, status: 'completed' },
        });
        await load();
        return;
      }
    }

    const { error } = await supabase.from('jobs').update(patch).eq('id', job.id);
    setBusyId(null);
    if (error) {
      toast.error('Could not update the job.');
      return;
    }
    if (nextStatus) {
      const label = nextStatus === 'complete' || nextStatus === 'completed' ? 'completed' : nextStatus === 'in_progress' ? 'started' : 'set to pending';
      logActivity(job.bike_id, {
        kind: 'job',
        action: nextStatus,
        summary: `Job ${label}: ${job.title}${isDone(nextStatus) ? ` (${money(job.actual_cost ?? job.estimated_cost)})` : ''}`,
        detail: { job_id: job.id, status: nextStatus },
      });
    }
    await load();
  };

  if (profile && !['admin', 'mechanic'].includes(profile.role)) {
    return <Panel><EmptyState fact="You do not have access to repair jobs." /></Panel>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Jobs"
        density="bench"
        description="Repair jobs that need doing, grouped by bike."
        actions={
          <Tabs value={filter} onValueChange={setFilter}>
            <TabsList>
              {FILTERS.map((f) => (
                <TabsTrigger key={f.value} value={f.value}>
                  {f.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        }
      />

      <Panel title="Repair jobs" hint={`${visible.length} jobs · ${groups.length} bikes`} bodyClassName="border-0 bg-transparent p-0">
        {loading ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <EmptyState
            fact="No jobs here."
            fix="Jobs are created from a bike record when work starts on it."
            action={null}
          />
        ) : (
          <div className="space-y-4">
          {groups.map((list) => list[0].bikes ? (
            <WorkshopBikeCard
              key={list[0].bike_id}
              bike={list[0].bikes}
              location={bayName(list[0].bikes.storage_bay_id)}
              badges={<Badge variant="secondary">{list.length} job{list.length === 1 ? '' : 's'}</Badge>}
            >
              {list.map((job) => (
            <div key={job.id} className="flex flex-col gap-3 rounded-[4px] border border-border p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 flex-1 space-y-1">
                <p className="break-words font-medium text-foreground">{job.title}</p>
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <Badge variant={isDone(job.status) ? 'success' : job.status === 'in_progress' ? 'warning' : 'outline'}>
                    {statusLabel(job.status)}
                  </Badge>
                  {job.started_at && <span>Started {formatDate(job.started_at)}</span>}
                  {job.completed_at && <span>Done {formatDate(job.completed_at)}</span>}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
                {!isDone(job.status) && !job.started_at && (
                  <Button size="bench" variant="outline" disabled={busyId === job.id}
                    onClick={() => update(job, { status: 'in_progress', started_at: new Date().toISOString() })}>
                    Start
                  </Button>
                )}
                {!isDone(job.status) && (
                  <Button size="bench" disabled={busyId === job.id} className={job.started_at ? 'col-span-2' : ''}
                    onClick={() => update(job, { status: 'complete', completed_at: new Date().toISOString() })}>
                    Done
                  </Button>
                )}
              </div>
            </div>
              ))}
            </WorkshopBikeCard>
          ) : null)}
          </div>
        )}
      </Panel>
    </div>
  );
}
