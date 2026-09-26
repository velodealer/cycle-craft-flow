import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { money } from '@/lib/reports';
import { useBpsDashboardData } from '@/hooks/useBpsDashboardData';
import { StatBlock } from '@/components/velo/StatBlock';
import { IntegrationTile } from '@/components/velo/IntegrationTile';
import { cn } from '@/lib/utils';

export default function BPSDashboard() {
  const { data, loading, error, reload } = useBpsDashboardData();

  const s = (key: string) => data?.statusCounts[key] ?? 0;
  const today = (stage: string) => data?.enteredToday[stage] ?? 0;

  const cards = [
    { title: 'In intake', count: s('pending_intake') + s('intake'), today: today('intake'), to: '/intake' },
    { title: 'Cleaning', count: s('cleaning'), today: today('cleaning'), to: '/cleaning' },
    { title: 'Inspection', count: s('inspection'), today: today('inspection'), to: '/inspection' },
    {
      title: 'Owner approval',
      count: data?.awaitingApproval ?? 0,
      today: 0,
      to: '/repairs',
      warn: (data?.awaitingApproval ?? 0) > 0,
      hint: data?.stuckApproval ? `${data.stuckApproval} stuck, nothing to approve` : undefined,
    },
    { title: 'Repair', count: data?.repairBikes ?? 0, today: 0, to: '/jobs', hint: `${data?.jobsWorkshop ?? 0} open repair jobs` },
    { title: 'Ready', count: s('ready'), today: today('ready'), to: '/listings?status=ready' },
    { title: 'Listed', count: s('listed') + s('in_stock'), today: 0, to: '/listings?status=listed', hint: `${s('listed')} listed · ${s('in_stock')} in stock` },
    {
      title: 'Sold',
      count: data?.soldThisMonth ?? 0,
      today: 0,
      to: '/invoices',
      hint: `${data?.soldLast7 ?? 0} in last 7 days`,
    },
    {
      title: 'Jobs in progress',
      count: data?.jobsOpen ?? 0,
      today: 0,
      to: '/jobs',
      hint: `${data?.jobsWorkshop ?? 0} workshop · ${data?.jobsDetailing ?? 0} detailing`,
    },
  ];

  const pipeline = data
    ? [
        { label: 'Intake → Cleaning', value: data.pipeline.intakeToCleaning },
        { label: 'Cleaning → Inspection', value: data.pipeline.cleaningToInspection },
        { label: 'Inspection → Approval', value: data.pipeline.inspectionToApproval },
      ]
    : [];
  const pipelineMax = Math.max(1, ...pipeline.map((p) => p.value));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-[28px] font-bold leading-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground tabular">
          {data ? `${data.totalInSystem} bikes in the book` : 'Loading your book…'}
        </p>
      </div>

      {error && (
        <div className="flex items-center justify-between rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm">
          <span>{error}</span>
          <Button size="sm" variant="outline" onClick={reload}>
            Retry
          </Button>
        </div>
      )}

      {/* Stage cards — task tickets, not decoration */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {loading || !data
          ? [0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => <Skeleton key={i} className="h-28" />)
          : cards.map((card) => (
              <Link
                key={card.title}
                to={card.to}
                className={cn(
                  'rounded-md border border-border bg-card p-4 transition-colors hover:bg-secondary',
                  card.warn && 'border-warning/60',
                )}
              >
                <p className="label-text">{card.title}</p>
                <p className={cn('mt-2 font-display text-[32px] font-bold leading-none animate-stat-tick tabular', card.warn && 'text-warning')}>
                  {card.count}
                </p>
                <div className="mt-2 min-h-[22px]">
                  {card.today > 0 ? (
                    <Badge variant="info">+{card.today} today</Badge>
                  ) : card.hint ? (
                    <span className="text-xs text-muted-foreground">{card.hint}</span>
                  ) : null}
                </div>
              </Link>
            ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Where does stock pile up?</CardTitle>
            <p className="text-sm text-muted-foreground">Stage moves, last 30 days</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading || !data ? (
              <div className="space-y-3">
                <Skeleton className="h-5" />
                <Skeleton className="h-5" />
                <Skeleton className="h-5" />
              </div>
            ) : (
              pipeline.map((row) => (
                <div key={row.label} className="space-y-1">
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="label-text">{row.label}</span>
                    <span className="font-medium tabular">{row.value}</span>
                  </div>
                  <div className="h-2 w-full rounded-[2px] bg-secondary">
                    <div
                      className="h-2 rounded-[2px] bg-primary"
                      style={{ width: `${Math.round((row.value / pipelineMax) * 100)}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Revenue this month</CardTitle>
            <p className="text-sm text-muted-foreground">Sales and workshop income</p>
          </CardHeader>
          <CardContent>
            {loading || !data ? (
              <div className="space-y-3">
                <Skeleton className="h-12" />
                <Skeleton className="h-12" />
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
                <StatBlock label="Total sales" value={money(data.revenue.total)} />
                <StatBlock label="Avg sale" value={money(data.revenue.avgSalePrice)} />
                <StatBlock label="Jobs revenue" value={money(data.revenue.services)} />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-3">
        <h2 className="text-xl font-semibold">System health</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <IntegrationTile
            name="Database"
            state={error ? 'error' : 'connected'}
            stateLabel={error ? 'Error' : 'Active'}
            lastError={error}
          />
          <IntegrationTile name="Authentication" state="connected" />
          <IntegrationTile
            name="Integrations"
            state="connected"
            stateLabel="Managed in Settings"
            detail="QuickBooks · Shopify · eBay · Typeform · InspectABike · Cycle Courier"
          />
          <IntegrationTile
            name="Figures updated"
            state="connected"
            stateLabel={
              data ? data.loadedAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '—'
            }
          />
        </div>
      </div>
    </div>
  );
}
