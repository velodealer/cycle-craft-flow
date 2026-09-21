import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader, Panel, EmptyState } from '@/components/velo/PageShell';
import { StatBlock } from '@/components/velo/StatBlock';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import SubscriptionDialog from '@/components/admin/SubscriptionDialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useDealershipStats, useIntegrationHealth, useSubscriptions, money } from '@/hooks/useAdminData';
import { statusVariant } from './AdminDealershipsPage';
import { ArrowLeft, CheckCircle, PauseCircle, PlayCircle } from 'lucide-react';

export default function AdminDealershipDetailPage() {
  const { id = '' } = useParams();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [editingSub, setEditingSub] = useState(false);

  const { data: stats } = useDealershipStats();
  const { data: subs } = useSubscriptions();
  const { data: health } = useIntegrationHealth();

  const { data: members } = useQuery({
    queryKey: ['admin', 'members', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').eq('business_id', id).order('created_at');
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!id,
  });

  const dealership = (stats ?? []).find((d) => d.business_id === id);
  const subscription = (subs ?? []).find((s) => s.business_id === id) ?? null;
  const connections = (health ?? []).filter((h) => h.business_id === id);
  const allBusinesses = stats ?? [];

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin'] });

  const setStatus = async (status: string) => {
    const { error } = await supabase.from('businesses').update({ status }).eq('id', id);
    if (error) toast({ title: 'Could not update', description: error.message, variant: 'destructive' });
    else {
      toast({ title: `Now ${status}` });
      refresh();
    }
  };

  const moveUser = async (profileId: string, businessId: string) => {
    const { error } = await supabase.from('profiles').update({ business_id: businessId }).eq('id', profileId);
    if (error) toast({ title: 'Could not move user', description: error.message, variant: 'destructive' });
    else {
      toast({ title: 'User moved' });
      queryClient.invalidateQueries({ queryKey: ['admin'] });
    }
  };

  if (!dealership) {
    return (
      <div className="space-y-6">
        <PageHeader title="Dealership" />
        <Panel><EmptyState fact="Loading, or this dealership no longer exists." /></Panel>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link to="/admin/dealerships"><ArrowLeft className="mr-1 h-4 w-4" /> All dealerships</Link>
      </Button>

      <PageHeader
        title={dealership.business_name}
        description={dealership.contact_email || 'No contact email on file'}
        actions={
          <div className="flex items-center gap-2">
            <Badge variant={statusVariant(dealership.status) as any}>{dealership.status}</Badge>
            {dealership.status === 'pending' && (
              <Button size="sm" onClick={() => setStatus('active')}><CheckCircle className="mr-1 h-4 w-4" /> Approve</Button>
            )}
            {dealership.status === 'active' && (
              <Button size="sm" variant="outline" onClick={() => setStatus('suspended')}><PauseCircle className="mr-1 h-4 w-4" /> Suspend</Button>
            )}
            {dealership.status === 'suspended' && (
              <Button size="sm" variant="outline" onClick={() => setStatus('active')}><PlayCircle className="mr-1 h-4 w-4" /> Reactivate</Button>
            )}
          </div>
        }
      />

      <Panel>
        <div className="grid grid-cols-2 gap-6 md:grid-cols-3 xl:grid-cols-6">
          <StatBlock label="Users" value={dealership.users_count} />
          <StatBlock label="Stock held" value={dealership.bikes_in_stock} />
          <StatBlock label="Bikes total" value={dealership.bikes_total} />
          <StatBlock label="Sold (30d)" value={dealership.bikes_sold} />
          <StatBlock label="Sales value (30d)" value={money(dealership.sale_value)} />
          <StatBlock label="Jobs done (30d)" value={dealership.jobs_completed} />
        </div>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel
          title="Subscription"
          actions={<Button size="sm" variant="outline" onClick={() => setEditingSub(true)}>{subscription ? 'Edit' : 'Set plan'}</Button>}
        >
          {subscription ? (
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div><dt className="label-text text-muted-foreground">Plan</dt><dd>{subscription.plan_name}</dd></div>
              <div><dt className="label-text text-muted-foreground">Status</dt><dd className="capitalize">{subscription.status.replace('_', ' ')}</dd></div>
              <div><dt className="label-text text-muted-foreground">Price</dt><dd className="tabular">{money(subscription.price, subscription.currency)} / {subscription.billing_period === 'yearly' ? 'year' : 'month'}</dd></div>
              <div><dt className="label-text text-muted-foreground">Seats</dt><dd className="tabular">{subscription.seats}</dd></div>
              <div><dt className="label-text text-muted-foreground">Renews</dt><dd>{subscription.current_period_end ? new Date(subscription.current_period_end).toLocaleDateString('en-GB') : '—'}</dd></div>
              <div><dt className="label-text text-muted-foreground">Trial ends</dt><dd>{subscription.trial_ends_at ? new Date(subscription.trial_ends_at).toLocaleDateString('en-GB') : '—'}</dd></div>
              {subscription.notes && (
                <div className="col-span-2"><dt className="label-text text-muted-foreground">Notes</dt><dd>{subscription.notes}</dd></div>
              )}
            </dl>
          ) : (
            <EmptyState fact="No plan recorded." fix="Set one so it counts towards monthly revenue." />
          )}
        </Panel>

        <Panel title="Integrations" bodyClassName="p-0">
          {connections.length === 0 ? (
            <EmptyState fact="Nothing connected yet." />
          ) : (
            <div>
              {connections.map((c, i) => (
                <div key={`${c.integration}-${i}`} className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 last:border-b-0">
                  <div className="min-w-0">
                    <p className="font-medium capitalize">{c.integration.replace(/_/g, ' ')}</p>
                    {c.last_error && <p className="truncate text-sm text-loss">{c.last_error}</p>}
                  </div>
                  <Badge variant={c.connected ? 'default' : 'destructive'}>{c.connected ? 'connected' : c.status || 'off'}</Badge>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <Panel title="Staff" hint="Move a user to a different dealership if they were placed wrongly." bodyClassName="p-0">
        {!members || members.length === 0 ? (
          <EmptyState fact="No users on this account." />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Dealership</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((m: any) => (
                  <TableRow key={m.id}>
                    <TableCell>
                      <div className="font-medium">{m.name}</div>
                      <div className="text-sm text-muted-foreground">{m.email}</div>
                    </TableCell>
                    <TableCell className="capitalize">{m.role}</TableCell>
                    <TableCell>
                      <Select value={m.business_id} onValueChange={(v) => v !== m.business_id && moveUser(m.id, v)}>
                        <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {allBusinesses.map((b) => (
                            <SelectItem key={b.business_id} value={b.business_id}>{b.business_name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Panel>

      <SubscriptionDialog
        open={editingSub}
        onOpenChange={setEditingSub}
        businessId={id}
        businessName={dealership.business_name}
        subscription={subscription}
      />
    </div>
  );
}
