import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EmptyState, FieldLabel, PageHeader, Panel, QueueRow } from '@/components/velo/PageShell';
import { bikeRef } from '@/lib/bikeReference';

interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface TimelineEvent {
  time: string;
  action: string;
  record: string;
  bikeId?: string;
}

const todayISO = () => new Date().toISOString().slice(0, 10);

const formatTime = (value: string) =>
  new Date(value).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

export default function StaffActivityPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const canSeeEveryone = profile?.role === 'admin' || profile?.role === 'owner';

  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [personId, setPersonId] = useState<string>('');
  const [date, setDate] = useState<string>(todayISO());
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!canSeeEveryone) {
        if (profile) {
          setStaff([{ id: profile.id, name: profile.name, email: profile.email, role: profile.role }]);
          setPersonId(profile.id);
        }
        return;
      }
      const { data } = await supabase.from('profiles').select('id, name, email, role').order('name');
      const list = (data as StaffMember[]) ?? [];
      setStaff(list);
      setPersonId((current) => current || profile?.id || list[0]?.id || '');
    })();
  }, [canSeeEveryone, profile]);

  useEffect(() => {
    if (!personId || !date) return;
    let active = true;
    setLoading(true);
    (async () => {
      const from = new Date(`${date}T00:00:00`).toISOString();
      const to = new Date(`${date}T23:59:59.999`).toISOString();
      const person = staff.find((s) => s.id === personId);

      const [jobsRes, inspectionsRes] = await Promise.all([
        supabase
          .from('jobs')
          .select('id, title, type, status, started_at, completed_at, created_at, bike_id, bikes(id, make, model, reference)')
          .eq('assigned_to', personId),
        supabase
          .from('inspections')
          .select('id, status, started_at, completed_at, inspector_name, bike_id, bikes(id, make, model, reference)')
          .gte('started_at', from)
          .lte('started_at', to),
      ]);

      if (!active) return;

      const collected: TimelineEvent[] = [];
      const inRange = (value: string | null) => !!value && value >= from && value <= to;
      const bikeName = (bike: { make: string; model: string; reference: string | null; id: string } | null) =>
        bike ? `${bike.make} ${bike.model} · ${bikeRef(bike)}` : 'Bike removed';

      for (const job of (jobsRes.data as never[] as {
        id: string; title: string; type: string; started_at: string | null; completed_at: string | null;
        created_at: string; bike_id: string; bikes: { id: string; make: string; model: string; reference: string | null } | null;
      }[]) ?? []) {
        if (inRange(job.created_at)) {
          collected.push({ time: job.created_at, action: `Job created — ${job.title}`, record: bikeName(job.bikes), bikeId: job.bike_id });
        }
        if (inRange(job.started_at)) {
          collected.push({ time: job.started_at as string, action: `Started ${job.type.replace(/_/g, ' ')} — ${job.title}`, record: bikeName(job.bikes), bikeId: job.bike_id });
        }
        if (inRange(job.completed_at)) {
          collected.push({ time: job.completed_at as string, action: `Completed ${job.title}`, record: bikeName(job.bikes), bikeId: job.bike_id });
        }
      }

      for (const inspection of (inspectionsRes.data as never[] as {
        id: string; status: string; started_at: string; completed_at: string | null; inspector_name: string | null;
        bike_id: string; bikes: { id: string; make: string; model: string; reference: string | null } | null;
      }[]) ?? []) {
        const matchesPerson =
          person && inspection.inspector_name
            ? inspection.inspector_name.toLowerCase().includes(person.name.toLowerCase())
            : false;
        if (!matchesPerson) continue;
        collected.push({ time: inspection.started_at, action: 'Inspection started', record: bikeName(inspection.bikes), bikeId: inspection.bike_id });
        if (inRange(inspection.completed_at)) {
          collected.push({ time: inspection.completed_at as string, action: 'Inspection completed', record: bikeName(inspection.bikes), bikeId: inspection.bike_id });
        }
      }

      collected.sort((a, b) => a.time.localeCompare(b.time));
      setEvents(collected);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [personId, date, staff]);

  const person = useMemo(() => staff.find((s) => s.id === personId), [staff, personId]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Staff activity"
        description="What each person did, on which bikes, on a given day."
        actions={
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <FieldLabel>Person</FieldLabel>
              <Select value={personId} onValueChange={setPersonId} disabled={!canSeeEveryone}>
                <SelectTrigger className="w-56">
                  <SelectValue placeholder="Choose a person" />
                </SelectTrigger>
                <SelectContent>
                  {staff.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.name} — {member.role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <FieldLabel>Date</FieldLabel>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44" />
            </div>
          </div>
        }
      />

      <Panel
        title={person ? person.name : 'Day timeline'}
        hint={`${events.length} recorded ${events.length === 1 ? 'action' : 'actions'}`}
        bodyClassName="p-0"
      >
        {loading ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : events.length === 0 ? (
          <EmptyState fact="Nothing recorded for this person on this day." fix="Try another date, or another member of the team." />
        ) : (
          events.map((event, i) => (
            <QueueRow
              key={`${event.time}-${i}`}
              onClick={event.bikeId ? () => navigate(`/bikes/${event.bikeId}`) : undefined}
            >
              <span className="id-text w-16 shrink-0 text-sm text-muted-foreground">{formatTime(event.time)}</span>
              <span className="min-w-0 flex-1 text-sm text-foreground">{event.action}</span>
              <span className="id-text shrink-0 text-xs text-muted-foreground">{event.record}</span>
            </QueueRow>
          ))
        )}
      </Panel>
    </div>
  );
}
