import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import ReportTable from './ReportTable';
import { avg, inRange, money, num, pct, sum, titleCase, type Range } from '@/lib/reports';
import type { BikeRow } from '@/lib/reportMetrics';
import type { ReportsData } from '@/hooks/useReportsData';

interface Props { rows: BikeRow[]; data: ReportsData; range: Range }

const STAGES = ['intake', 'cleaning', 'inspection', 'repair', 'ready'] as const;

export default function OperationsSection({ rows, data, range }: Props) {
  const ids = useMemo(() => new Set(rows.map((r) => r.id)), [rows]);

  const funnel = useMemo(() => {
    const events = data.events.filter((e) => ids.has(e.bike_id));
    const byBike = new Map<string, any[]>();
    for (const e of events) {
      const list = byBike.get(e.bike_id) || [];
      list.push(e);
      byBike.set(e.bike_id, list);
    }
    for (const list of byBike.values()) list.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    const reached = new Map<string, number>();
    const durations = new Map<string, number[]>();
    for (const list of byBike.values()) {
      for (let i = 0; i < list.length; i++) {
        const stage = list[i].stage;
        reached.set(stage, (reached.get(stage) || 0) + 1);
        const next = list[i + 1];
        if (next) {
          const hrs = (new Date(next.timestamp).getTime() - new Date(list[i].timestamp).getTime()) / 36e5;
          const arr = durations.get(stage) || [];
          arr.push(hrs);
          durations.set(stage, arr);
        }
      }
    }
    const first = reached.get('intake') || byBike.size || 0;
    return STAGES.map((s) => {
      const d = durations.get(s) || [];
      return {
        stage: titleCase(s),
        bikes: reached.get(s) || 0,
        conversion: first ? (reached.get(s) || 0) / first : 0,
        avgHours: d.length ? d.reduce((a, b) => a + b, 0) / d.length : 0,
      };
    });
  }, [data.events, ids]);

  const jobs = useMemo(
    () => data.jobs.filter((j) => ids.has(j.bike_id) && inRange(j.completed_at || j.created_at, range)),
    [data.jobs, ids, range],
  );

  const jobStats = useMemo(() => {
    const done = jobs.filter((j) => j.status === 'completed' || j.completed_at);
    const withBoth = done.filter((j) => j.estimated_cost != null && j.actual_cost != null);
    const variance = sum(withBoth, (j) => Number(j.actual_cost) - Number(j.estimated_cost));
    return {
      total: jobs.length,
      done: done.length,
      avgCost: avg(done, (j) => Number(j.actual_cost ?? j.estimated_cost ?? 0)),
      spend: sum(done, (j) => Number(j.actual_cost ?? j.estimated_cost ?? 0)),
      variance,
      variancePct: sum(withBoth, (j) => Number(j.estimated_cost)) > 0
        ? variance / sum(withBoth, (j) => Number(j.estimated_cost)) : 0,
    };
  }, [jobs]);

  const byType = useMemo(() => {
    const types = Array.from(new Set(jobs.map((j) => j.type)));
    return types.map((t) => {
      const list = jobs.filter((j) => j.type === t);
      return {
        type: titleCase(t),
        count: list.length,
        completed: list.filter((j) => j.completed_at).length,
        spend: sum(list, (j) => Number(j.actual_cost ?? j.estimated_cost ?? 0)),
        avg: avg(list, (j) => Number(j.actual_cost ?? j.estimated_cost ?? 0)),
      };
    });
  }, [jobs]);

  const inspectionStats = useMemo(() => {
    const insp = data.inspections.filter((i) => ids.has(i.bike_id) && inRange(i.created_at, range));
    const faults = data.faults.filter((f) => ids.has(f.bike_id) && inRange(f.created_at, range));
    const clean = insp.filter((i) => !i.has_issues).length;
    return {
      inspections: insp.length,
      clean,
      cleanPct: insp.length ? clean / insp.length : 0,
      faults: faults.length,
      faultsPerBike: insp.length ? faults.length / insp.length : 0,
      approved: faults.filter((f) => ['approved', 'awaiting_part', 'repaired'].includes(f.status)).length,
      declined: faults.filter((f) => f.status === 'declined').length,
      rectification: sum(faults.filter((f) => f.status === 'repaired'), (f) => Number(f.parts_cost || 0) + Number(f.labour_cost || 0)),
      avgGrade: avg(insp.filter((i) => i.overall_grade != null), (i) => Number(i.overall_grade)),
    };
  }, [data.inspections, data.faults, ids, range]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Pipeline funnel</CardTitle>
          <CardDescription>Bikes reaching each stage, and how long they wait before moving on.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={funnel} layout="vertical" margin={{ left: 30 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                <YAxis type="category" dataKey="stage" width={90} tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', fontSize: 12 }} />
                <Bar dataKey="bikes" fill="hsl(var(--primary))" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <ReportTable
            rows={funnel}
            rowKey={(r) => r.stage}
            csvName="pipeline-funnel"
            initialSort="bikes"
            columns={[
              { key: 'stage', label: 'Stage', value: (r) => r.stage },
              { key: 'bikes', label: 'Bikes', right: true, value: (r) => r.bikes },
              { key: 'conversion', label: 'Reached', right: true, value: (r) => pct(r.conversion), sortValue: (r) => r.conversion },
              { key: 'avgHours', label: 'Avg wait', right: true, value: (r) => (r.avgHours ? `${num(r.avgHours / 24, 1)} d` : '—'), sortValue: (r) => r.avgHours },
            ]}
          />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Workshop</CardTitle>
            <CardDescription>Jobs in the selected period.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Stat label="Jobs" value={String(jobStats.total)} sub={`${jobStats.done} completed`} />
              <Stat label="Workshop spend" value={money(jobStats.spend)} sub={`${money(jobStats.avgCost)} avg`} />
              <Stat label="Estimate variance" value={money(jobStats.variance)} sub={pct(jobStats.variancePct)} />
              <Stat label="Completion rate" value={pct(jobStats.total ? jobStats.done / jobStats.total : 0)} />
            </div>
            <ReportTable
              rows={byType}
              rowKey={(r) => r.type}
              csvName="jobs-by-type"
              initialSort="count"
              columns={[
                { key: 'type', label: 'Job type', value: (r) => r.type },
                { key: 'count', label: 'Jobs', right: true, value: (r) => r.count },
                { key: 'completed', label: 'Done', right: true, value: (r) => r.completed },
                { key: 'spend', label: 'Spend', right: true, value: (r) => money(r.spend), sortValue: (r) => r.spend },
                { key: 'avg', label: 'Avg cost', right: true, value: (r) => money(r.avg), sortValue: (r) => r.avg },
              ]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Inspections & faults</CardTitle>
            <CardDescription>Condition of what you're buying.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Stat label="Inspections" value={String(inspectionStats.inspections)} sub={`${pct(inspectionStats.cleanPct)} fault free`} />
              <Stat label="Faults raised" value={String(inspectionStats.faults)} sub={`${num(inspectionStats.faultsPerBike, 1)} per bike`} />
              <Stat label="Approved" value={String(inspectionStats.approved)} sub={`${inspectionStats.declined} declined`} />
              <Stat label="Rectification cost" value={money(inspectionStats.rectification)} sub={inspectionStats.avgGrade ? `avg grade ${num(inspectionStats.avgGrade, 1)}` : undefined} />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold mt-1 tabular-nums">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}
