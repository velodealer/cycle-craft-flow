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

  const update = async (job: JobRow, patch: Record<string, unknown>) => {
    setBusyId(job.id);
    const { error } = await supabase.from('jobs').update(patch).eq('id', job.id);
    setBusyId(null);
    if (error) {
      toast.error('Could not update the job.');
      return;
    }
    const nextStatus = patch.status as string | undefined;
    if (nextStatus) {
      const label = nextStatus === 'complete' ? 'completed' : nextStatus === 'in_progress' ? 'started' : 'set to pending';
      logActivity(job.bike_id, {
        kind: 'job',
        action: nextStatus,
        summary: `Job ${label}: ${job.title}${nextStatus === 'complete' ? ` (${money(job.actual_cost ?? job.estimated_cost)})` : ''}`,
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
        description="Workshop and detailing jobs across every bike on the floor."
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

      <Panel title="Jobs" hint={`${visible.length} shown`} bodyClassName="p-0">
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
          visible.map((job) => (
            <QueueRow key={job.id} density="bench" className="flex-wrap justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-foreground">{job.title}</span>
                  <Badge variant={job.status === 'complete' ? 'success' : job.status === 'in_progress' ? 'warning' : 'outline'}>
                    {statusLabel(job.status)}
                  </Badge>
                  <Badge variant="secondary">{job.type.replace(/_/g, ' ')}</Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {job.bikes ? `${job.bikes.make} ${job.bikes.model}` : 'Bike removed'}
                  {job.bikes ? <span className="id-text ml-2">{bikeRef(job.bikes)}</span> : null}
                  <span className="ml-3">Started {formatDate(job.started_at)}</span>
                  {job.completed_at ? <span className="ml-3">Done {formatDate(job.completed_at)}</span> : null}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                {job.bikes && (
                  <Button variant="ghost" size="bench" onClick={() => navigate(`/bikes/${job.bike_id}`)}>
                    Open bike
                  </Button>
                )}
                {job.status !== 'complete' && !job.started_at && (
                  <Button
                    size="bench"
                    variant="outline"
                    disabled={busyId === job.id}
                    onClick={() => update(job, { status: 'in_progress', started_at: new Date().toISOString() })}
                  >
                    Start
                  </Button>
                )}
                {job.status !== 'complete' && (
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
          ))
        )}
      </Panel>
    </div>
  );
}
