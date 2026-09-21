import { useMemo, useState } from 'react';
import { PageHeader, Panel, EmptyState } from '@/components/velo/PageShell';
import { StatBlock } from '@/components/velo/StatBlock';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import SubscriptionDialog from '@/components/admin/SubscriptionDialog';
import { useDealershipStats, useSubscriptions, money, type SubscriptionRow } from '@/hooks/useAdminData';

const badgeVariant = (status?: string | null) =>
  status === 'active' ? 'default' : status === 'past_due' ? 'destructive' : 'secondary';

export default function AdminSubscriptionsPage() {
  const { data: dealerships, isLoading } = useDealershipStats();
  const { data: subs } = useSubscriptions();
  const [editing, setEditing] = useState<{ id: string; name: string; sub?: SubscriptionRow | null } | null>(null);

  const subByBusiness = useMemo(() => {
    const map = new Map<string, SubscriptionRow>();
    (subs ?? []).forEach((s) => map.set(s.business_id, s));
    return map;
  }, [subs]);

  const mrr = (subs ?? [])
    .filter((s) => ['active', 'trialling'].includes(s.status))
    .reduce((sum, s) => sum + (s.billing_period === 'yearly' ? Number(s.price) / 12 : Number(s.price)), 0);

  const rows = dealerships ?? [];

  return (
    <div className="space-y-6">
      <PageHeader title="Subscriptions" description="What each dealership pays. Kept by hand for now." />

      <Panel>
        <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
          <StatBlock label="Monthly revenue" value={money(mrr)} />
          <StatBlock label="Paying" value={(subs ?? []).filter((s) => s.status === 'active').length} />
          <StatBlock label="Trialling" value={(subs ?? []).filter((s) => s.status === 'trialling').length} />
          <StatBlock label="No plan set" value={rows.filter((d) => !subByBusiness.get(d.business_id)).length} />
        </div>
      </Panel>

      <Panel bodyClassName="p-0">
        {isLoading ? (
          <p className="p-4 text-sm text-muted-foreground">Loading…</p>
        ) : rows.length === 0 ? (
          <EmptyState fact="No dealerships yet." />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Dealership</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead>Billing</TableHead>
                  <TableHead className="text-right">Seats</TableHead>
                  <TableHead>Renews</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((d) => {
                  const sub = subByBusiness.get(d.business_id);
                  return (
                    <TableRow key={d.business_id}>
                      <TableCell className="font-medium">{d.business_name}</TableCell>
                      <TableCell>{sub?.plan_name || <span className="text-muted-foreground">Not set</span>}</TableCell>
                      <TableCell className="tabular text-right">
                        {sub ? money(sub.price, sub.currency) : '—'}
                      </TableCell>
                      <TableCell className="capitalize">{sub?.billing_period ?? '—'}</TableCell>
                      <TableCell className="tabular text-right">{sub?.seats ?? '—'}</TableCell>
                      <TableCell>
                        {sub?.current_period_end ? new Date(sub.current_period_end).toLocaleDateString('en-GB') : '—'}
                      </TableCell>
                      <TableCell>
                        {sub ? (
                          <Badge variant={badgeVariant(sub.status) as any}>{sub.status.replace('_', ' ')}</Badge>
                        ) : (
                          <Badge variant="outline">none</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditing({ id: d.business_id, name: d.business_name, sub })}
                        >
                          {sub ? 'Edit' : 'Set plan'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Panel>

      {editing && (
        <SubscriptionDialog
          open={!!editing}
          onOpenChange={(open) => !open && setEditing(null)}
          businessId={editing.id}
          businessName={editing.name}
          subscription={editing.sub}
        />
      )}
    </div>
  );
}
