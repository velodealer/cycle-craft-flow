import { useState } from 'react';
import { PageHeader, Panel, EmptyState } from '@/components/velo/PageShell';
import { StatBlock } from '@/components/velo/StatBlock';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useDealershipStats, useIntegrationHealth, usePlatformOverview, money } from '@/hooks/useAdminData';

const periods = [
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: '365', label: 'Last 12 months' },
];

export default function AdminAnalyticsPage() {
  const [days, setDays] = useState('30');
  const from = new Date(Date.now() - Number(days) * 24 * 60 * 60 * 1000);
  const { data: stats, isLoading } = useDealershipStats(from, new Date());
  const { data: overview } = usePlatformOverview();
  const { data: health } = useIntegrationHealth();

  const rows = stats ?? [];
  const totals = rows.reduce(
    (acc, r) => ({
      bikesAdded: acc.bikesAdded + Number(r.bikes_added),
      bikesSold: acc.bikesSold + Number(r.bikes_sold),
      saleValue: acc.saleValue + Number(r.sale_value),
      jobs: acc.jobs + Number(r.jobs_completed),
    }),
    { bikesAdded: 0, bikesSold: 0, saleValue: 0, jobs: 0 },
  );

  const integrationNames = Array.from(new Set((health ?? []).map((h) => h.integration))).sort();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description="Activity, trading and platform growth across every dealership."
        actions={
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              {periods.map((p) => (
                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      <Tabs defaultValue="usage" className="space-y-4">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 bg-transparent p-0">
          <TabsTrigger value="usage" className="data-[state=active]:bg-secondary">Usage</TabsTrigger>
          <TabsTrigger value="trading" className="data-[state=active]:bg-secondary">Trading</TabsTrigger>
          <TabsTrigger value="platform" className="data-[state=active]:bg-secondary">Platform</TabsTrigger>
          <TabsTrigger value="integrations" className="data-[state=active]:bg-secondary">Integrations</TabsTrigger>
        </TabsList>

        <TabsContent value="usage" className="space-y-4">
          <Panel>
            <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
              <StatBlock label="Bikes added" value={totals.bikesAdded} />
              <StatBlock label="Jobs completed" value={totals.jobs} />
              <StatBlock label="Users" value={rows.reduce((s, r) => s + Number(r.users_count), 0)} />
              <StatBlock label="Active dealerships" value={rows.filter((r) => Number(r.bikes_added) + Number(r.jobs_completed) > 0).length} />
            </div>
          </Panel>
          <Panel title="By dealership" bodyClassName="p-0">
            {isLoading ? (
              <p className="p-4 text-sm text-muted-foreground">Loading…</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Dealership</TableHead>
                      <TableHead className="text-right">Users</TableHead>
                      <TableHead className="text-right">Bikes added</TableHead>
                      <TableHead className="text-right">Jobs completed</TableHead>
                      <TableHead>Last activity</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow key={r.business_id}>
                        <TableCell className="font-medium">{r.business_name}</TableCell>
                        <TableCell className="tabular text-right">{r.users_count}</TableCell>
                        <TableCell className="tabular text-right">{r.bikes_added}</TableCell>
                        <TableCell className="tabular text-right">{r.jobs_completed}</TableCell>
                        <TableCell>{r.last_activity ? new Date(r.last_activity).toLocaleDateString('en-GB') : '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </Panel>
        </TabsContent>

        <TabsContent value="trading" className="space-y-4">
          <Panel>
            <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
              <StatBlock label="Bikes sold" value={totals.bikesSold} />
              <StatBlock label="Sales value" value={money(totals.saleValue)} />
              <StatBlock label="Stock held" value={rows.reduce((s, r) => s + Number(r.bikes_in_stock), 0)} />
              <StatBlock
                label="Average sale"
                value={money(totals.bikesSold ? totals.saleValue / totals.bikesSold : 0)}
              />
            </div>
          </Panel>
          <Panel title="By dealership" bodyClassName="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dealership</TableHead>
                    <TableHead className="text-right">Stock held</TableHead>
                    <TableHead className="text-right">Sold</TableHead>
                    <TableHead className="text-right">Sales value</TableHead>
                    <TableHead className="text-right">Average sale</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.business_id}>
                      <TableCell className="font-medium">{r.business_name}</TableCell>
                      <TableCell className="tabular text-right">{r.bikes_in_stock}</TableCell>
                      <TableCell className="tabular text-right">{r.bikes_sold}</TableCell>
                      <TableCell className="tabular text-right">{money(r.sale_value)}</TableCell>
                      <TableCell className="tabular text-right">
                        {money(Number(r.bikes_sold) ? Number(r.sale_value) / Number(r.bikes_sold) : 0)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Panel>
        </TabsContent>

        <TabsContent value="platform" className="space-y-4">
          <Panel>
            {overview ? (
              <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
                <StatBlock label="Dealerships" value={overview.total_businesses} />
                <StatBlock label="New (30d)" value={overview.new_businesses_30d} />
                <StatBlock label="Suspended" value={overview.suspended_businesses} />
                <StatBlock label="Monthly revenue" value={money(overview.mrr)} />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Loading…</p>
            )}
          </Panel>
          <Panel title="Sign-ups by month" bodyClassName="p-0">
            {!overview || overview.signups_by_month.length === 0 ? (
              <EmptyState fact="No sign-ups recorded yet." />
            ) : (
              <div className="flex items-end gap-2 overflow-x-auto p-4">
                {overview.signups_by_month.map((m) => {
                  const max = Math.max(...overview.signups_by_month.map((x) => Number(x.count)), 1);
                  return (
                    <div key={m.month} className="flex min-w-[48px] flex-1 flex-col items-center gap-2">
                      <span className="tabular text-xs text-muted-foreground">{m.count}</span>
                      <div className="w-full rounded-[2px] bg-primary" style={{ height: `${Math.max(4, (Number(m.count) / max) * 120)}px` }} />
                      <span className="text-[11px] text-muted-foreground">{m.month.slice(5)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>
        </TabsContent>

        <TabsContent value="integrations">
          <Panel title="Connections by dealership" bodyClassName="p-0">
            {!health || health.length === 0 ? (
              <EmptyState fact="No connections recorded." />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Dealership</TableHead>
                      {integrationNames.map((n) => (
                        <TableHead key={n} className="capitalize">{n.replace(/_/g, ' ')}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow key={r.business_id}>
                        <TableCell className="font-medium">{r.business_name}</TableCell>
                        {integrationNames.map((n) => {
                          const entry = health.find((h) => h.business_id === r.business_id && h.integration === n);
                          return (
                            <TableCell key={n}>
                              {!entry ? (
                                <span className="text-muted-foreground">—</span>
                              ) : entry.connected ? (
                                <Badge>connected</Badge>
                              ) : (
                                <Badge variant="destructive">{entry.status || 'off'}</Badge>
                              )}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </Panel>
        </TabsContent>
      </Tabs>
    </div>
  );
}
