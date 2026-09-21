import { Link } from 'react-router-dom';
import { PageHeader, Panel, EmptyState } from '@/components/velo/PageShell';
import { StatBlock } from '@/components/velo/StatBlock';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { usePlatformOverview, useDealershipStats, useIntegrationHealth, money } from '@/hooks/useAdminData';

export default function AdminOverviewPage() {
  const { data: overview, isLoading } = usePlatformOverview();
  const { data: dealerships } = useDealershipStats();
  const { data: health } = useIntegrationHealth();

  const pending = (dealerships ?? []).filter((d) => d.status === 'pending');
  const failing = (health ?? []).filter((h) => !h.connected);

  return (
    <div className="space-y-6">
      <PageHeader title="Platform overview" description="How VeloDealer is trading across every dealership." />

      <Panel>
        {isLoading || !overview ? (
          <p className="text-sm text-muted-foreground">Loading figures…</p>
        ) : (
          <div className="grid grid-cols-2 gap-6 md:grid-cols-3 xl:grid-cols-6">
            <StatBlock label="Dealerships" value={overview.total_businesses} hint={`${overview.active_businesses} active`} />
            <StatBlock label="Awaiting approval" value={overview.pending_businesses} />
            <StatBlock label="Suspended" value={overview.suspended_businesses} />
            <StatBlock label="Users" value={overview.total_users} hint={`${overview.new_users_30d} new in 30 days`} />
            <StatBlock label="Monthly revenue" value={money(overview.mrr)} hint={`${overview.paying_subscriptions} paying`} />
            <StatBlock label="Bikes sold (30d)" value={overview.bikes_sold_30d} hint={`${overview.total_bikes} on the books`} />
          </div>
        )}
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel
          title="Awaiting approval"
          hint="New sign-ups that cannot use the system yet."
          actions={
            <Button asChild size="sm" variant="outline">
              <Link to="/admin/dealerships">Open dealerships</Link>
            </Button>
          }
          bodyClassName="p-0"
        >
          {pending.length === 0 ? (
            <EmptyState fact="Nothing waiting." fix="New sign-ups will appear here for approval." />
          ) : (
            <div>
              {pending.map((d) => (
                <div key={d.business_id} className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 last:border-b-0">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{d.business_name}</p>
                    <p className="truncate text-sm text-muted-foreground">{d.contact_email || '—'}</p>
                  </div>
                  <Button asChild size="sm">
                    <Link to={`/admin/dealerships/${d.business_id}`}>Review</Link>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Integrations needing attention" hint="Connections that are off or reporting an error." bodyClassName="p-0">
          {failing.length === 0 ? (
            <EmptyState fact="Every connection is healthy." />
          ) : (
            <div>
              {failing.slice(0, 12).map((h, i) => (
                <div key={`${h.business_id}-${h.integration}-${i}`} className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 last:border-b-0">
                  <div className="min-w-0">
                    <p className="truncate font-medium capitalize">{h.integration.replace(/_/g, ' ')}</p>
                    <p className="truncate text-sm text-muted-foreground">{h.business_name}</p>
                  </div>
                  <Badge variant="destructive">{h.status || 'not connected'}</Badge>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <Panel title="Sign-ups by month" hint="New dealerships over the last twelve months." bodyClassName="p-0">
        {!overview || overview.signups_by_month.length === 0 ? (
          <EmptyState fact="No sign-ups recorded yet." />
        ) : (
          <div className="flex items-end gap-2 overflow-x-auto p-4">
            {overview.signups_by_month.map((m) => {
              const max = Math.max(...overview.signups_by_month.map((x) => Number(x.count)), 1);
              return (
                <div key={m.month} className="flex min-w-[48px] flex-1 flex-col items-center gap-2">
                  <span className="tabular text-xs text-muted-foreground">{m.count}</span>
                  <div
                    className="w-full rounded-[2px] bg-primary"
                    style={{ height: `${Math.max(4, (Number(m.count) / max) * 120)}px` }}
                  />
                  <span className="text-[11px] text-muted-foreground">{m.month.slice(5)}</span>
                </div>
              );
            })}
          </div>
        )}
      </Panel>
    </div>
  );
}
