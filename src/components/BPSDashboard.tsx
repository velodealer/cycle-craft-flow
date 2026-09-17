import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Package,
  Sparkles,
  Search,
  AlertCircle,
  Wrench,
  CheckCircle,
  Eye,
  ShoppingCart,
  Clock,
} from 'lucide-react';
import { money } from '@/lib/reports';
import { useBpsDashboardData } from '@/hooks/useBpsDashboardData';

export default function BPSDashboard() {
  const { data, loading, error, reload } = useBpsDashboardData();

  const s = (key: string) => data?.statusCounts[key] ?? 0;
  const today = (stage: string) => data?.enteredToday[stage] ?? 0;
  const todayLabel = (stage: string) => {
    const n = today(stage);
    return n > 0 ? `+${n} today` : 'None today';
  };

  const cards = [
    {
      title: 'In Intake',
      count: s('pending_intake') + s('intake'),
      description: 'Bikes just received and being processed',
      icon: Package,
      color: 'secondary' as const,
      trend: todayLabel('intake'),
    },
    {
      title: 'Cleaning',
      count: s('cleaning'),
      description: 'Bikes currently being cleaned',
      icon: Sparkles,
      color: 'default' as const,
      trend: todayLabel('cleaning'),
    },
    {
      title: 'Inspection',
      count: s('inspection'),
      description: 'Mechanical inspection in progress',
      icon: Search,
      color: 'default' as const,
      trend: todayLabel('inspection'),
    },
    {
      title: 'Awaiting Owner Approval',
      count: s('pending_approval'),
      description: 'Waiting for owner repair approval',
      icon: AlertCircle,
      color: 'destructive' as const,
      trend: `${s('pending_approval')} to review`,
    },
    {
      title: 'Repair in Progress',
      count: s('repair'),
      description: 'Currently being repaired',
      icon: Wrench,
      color: 'outline' as const,
      trend: todayLabel('repair'),
    },
    {
      title: 'Ready to List',
      count: s('ready'),
      description: 'Completed and ready for sale',
      icon: CheckCircle,
      color: 'default' as const,
      trend: todayLabel('ready'),
    },
    {
      title: 'Listed',
      count: s('listed'),
      description: 'Currently listed for sale',
      icon: Eye,
      color: 'secondary' as const,
      trend: `${s('in_stock')} in stock`,
    },
    {
      title: 'Sold',
      count: data?.soldThisMonth ?? 0,
      description: 'Successfully sold this month',
      icon: ShoppingCart,
      color: 'default' as const,
      trend: `${data?.soldLast7 ?? 0} in last 7 days`,
    },
    {
      title: 'Jobs in Progress',
      count: data?.jobsOpen ?? 0,
      description: 'Active workshop and detailing jobs',
      icon: Clock,
      color: 'outline' as const,
      trend: `${data?.jobsWorkshop ?? 0} workshop, ${data?.jobsDetailing ?? 0} detailing`,
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Overview of your bike processing system
          {data ? ` • ${data.totalInSystem} bikes in system` : ''}
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 flex items-center justify-between text-sm">
          <span>{error}</span>
          <Button size="sm" variant="outline" onClick={reload}>Retry</Button>
        </div>
      )}

      {/* Status Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {loading || !data
          ? [0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => <Skeleton key={i} className="h-36" />)
          : cards.map((card) => {
              const Icon = card.icon;
              return (
                <Card key={card.title} className="hover:shadow-md transition-shadow">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{card.count}</div>
                    <p className="text-xs text-muted-foreground mb-2">{card.description}</p>
                    <Badge variant={card.color} className="text-xs">{card.trend}</Badge>
                  </CardContent>
                </Card>
              );
            })}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Processing Pipeline</CardTitle>
            <CardDescription>Stage moves in the last 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            {loading || !data ? (
              <div className="space-y-2"><Skeleton className="h-5" /><Skeleton className="h-5" /><Skeleton className="h-5" /></div>
            ) : (
              <div className="space-y-2">
                <Row label="Intake → Cleaning" value={`${data.pipeline.intakeToCleaning} bikes`} />
                <Row label="Cleaning → Inspection" value={`${data.pipeline.cleaningToInspection} bikes`} />
                <Row label="Inspection → Repair" value={`${data.pipeline.inspectionToApproval} bikes`} />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Revenue Tracking</CardTitle>
            <CardDescription>This month's performance</CardDescription>
          </CardHeader>
          <CardContent>
            {loading || !data ? (
              <div className="space-y-2"><Skeleton className="h-5" /><Skeleton className="h-5" /><Skeleton className="h-5" /></div>
            ) : (
              <div className="space-y-2">
                <Row label="Total Sales" value={money(data.revenue.total)} />
                <Row label="Avg. Sale Price" value={money(data.revenue.avgSalePrice)} />
                <Row label="Jobs Revenue" value={money(data.revenue.services)} />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">System Health</CardTitle>
            <CardDescription>Current system status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm">Database</span>
                <Badge variant={error ? 'destructive' : 'default'} className="text-xs">
                  {error ? 'Error' : 'Active'}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Authentication</span>
                <Badge variant="default" className="text-xs">Connected</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Figures updated</span>
                <span className="text-xs text-muted-foreground">
                  {data ? data.loadedAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '—'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-sm">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}
