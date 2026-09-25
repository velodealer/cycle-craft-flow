import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { functionErrorMessage } from '@/services/inspectabike';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmptyState, PageHeader, Panel, QueueRow } from '@/components/velo/PageShell';
import { bikeRef } from '@/lib/bikeReference';
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
  bikes: { id: string; make: string; model: string; reference: string | null } | null;
}

const FILTERS = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'complete', label: 'Done' },
  { value: 'all', label: 'All' },
];

const isDone = (status: string) => status === 'complete' || status === 'completed';

const statusLabel = (status: string) =>
  isDone(status) ? 'Done' : status === 'in_progress' ? 'In progress' : 'Pending';

const formatDate = (value: string | null) =>
  value ? new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '—';

export default function JobsPage() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('open');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    const { data, error } = await supabase
      .from('jobs')
      .select(
        'id, title, type, status, description, assigned_to, started_at, completed_at, created_at, estimated_cost, actual_cost, bike_id, bikes(id, make, model, reference)',
      )
      .eq('type', 'workshop')
      .order('created_at', { ascending: false });
    if (error) {
      toast.error('Could not load jobs.');
    } else {
      setJobs((data as unknown as JobRow[]) ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const visible = useMemo(() => {
    if (filter === 'all') return jobs;
    if (filter === 'open') return jobs.filter((j) => !isDone(j.status));
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

      <Panel title="Jobs" hint={`${visible.length} jobs · ${groups.length} bikes`} bodyClassName="p-0">
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
            action={<Button onClick={() => navigate('/bikes')}>Go to bikes</Button>}
          />
        ) : (
          groups.map((list) => (
            <div key={list[0].bike_id} className="border-b border-border last:border-b-0">
              <div className="flex flex-wrap items-center justify-between gap-2 bg-secondary/40 px-4 py-2">
                {list[0].bikes ? (
                  <a href={`/bikes/${list[0].bike_id}`} onClick={(e) => { e.preventDefault(); navigate(`/bikes/${list[0].bike_id}`); }} className="min-w-0 font-medium hover:underline">
                    {list[0].bikes.make} {list[0].bikes.model}
                    <span className="id-text ml-2">{bikeRef(list[0].bikes)}</span>
                  </a>
                ) : <span className="text-muted-foreground">Bike removed</span>}
                <span className="text-xs text-muted-foreground">{list.length} job{list.length === 1 ? '' : 's'}</span>
              </div>
              {list.map((job) => (
            <QueueRow key={job.id} density="bench" className="flex-wrap justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-foreground">{job.title}</span>
                  <Badge variant={isDone(job.status) ? 'success' : job.status === 'in_progress' ? 'warning' : 'outline'}>
                    {statusLabel(job.status)}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  <span>Started {formatDate(job.started_at)}</span>
                  {job.completed_at ? <span className="ml-3">Done {formatDate(job.completed_at)}</span> : null}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                {job.bikes && (
                  <Button variant="ghost" size="bench" onClick={() => navigate(`/bikes/${job.bike_id}`)}>
                    Open bike
                  </Button>
                )}
                {!isDone(job.status) && !job.started_at && (
                  <Button
                    size="bench"
                    variant="outline"
                    disabled={busyId === job.id}
                    onClick={() => update(job, { status: 'in_progress', started_at: new Date().toISOString() })}
                  >
                    Start
                  </Button>
                )}
                {!isDone(job.status) && (
                  <Button
                    size="bench"
                    disabled={busyId === job.id}
                    onClick={() => update(job, { status: 'complete', completed_at: new Date().toISOString() })}
                  >
                    Done
                  </Button>
                )}
              </div>
            </QueueRow>
              ))}
            </div>
          ))
        )}
      </Panel>
    </div>
  );
}
