import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { PageHeader, Panel, EmptyState } from '@/components/velo/PageShell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useDealershipStats, money } from '@/hooks/useAdminData';
import { CheckCircle, PauseCircle, PlayCircle, Plus } from 'lucide-react';

export const statusVariant = (status?: string | null) =>
  status === 'active' ? 'default' : status === 'pending' ? 'secondary' : 'destructive';

export default function AdminDealershipsPage() {
  const { data: dealerships, isLoading } = useDealershipStats();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin'] });

  const setStatus = async (id: string, name: string, status: string) => {
    const { error } = await supabase.from('businesses').update({ status }).eq('id', id);
    if (error) toast({ title: 'Could not update dealership', description: error.message, variant: 'destructive' });
    else {
      toast({ title: `${name} is now ${status}` });
      refresh();
    }
  };

  const createBusiness = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    const { error } = await supabase.from('businesses').insert({ name: newName.trim(), status: 'active' });
    setCreating(false);
    if (error) toast({ title: 'Could not create dealership', description: error.message, variant: 'destructive' });
    else {
      setNewName('');
      refresh();
    }
  };

  const rows = (dealerships ?? []).filter((d) =>
    d.business_name.toLowerCase().includes(search.trim().toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Dealerships" description="Approve, suspend and inspect every business on the platform." />

      <Panel bodyClassName="p-0">
        <div className="flex flex-wrap items-end gap-3 border-b border-border p-4">
          <div className="min-w-[200px] flex-1 space-y-1">
            <Label htmlFor="search">Search</Label>
            <Input id="search" placeholder="Dealership name" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="new-business">New dealership</Label>
            <div className="flex gap-2">
              <Input id="new-business" placeholder="Business name" value={newName} onChange={(e) => setNewName(e.target.value)} />
              <Button onClick={createBusiness} disabled={creating || !newName.trim()}>
                <Plus className="mr-1 h-4 w-4" /> Create
              </Button>
            </div>
          </div>
        </div>

        {isLoading ? (
          <p className="p-4 text-sm text-muted-foreground">Loading dealerships…</p>
        ) : rows.length === 0 ? (
          <EmptyState fact="No dealerships match." fix="Clear the search to see them all." />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Dealership</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead className="text-right">Users</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead className="text-right">Sold (30d)</TableHead>
                  <TableHead className="text-right">Sales value</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((d) => (
                  <TableRow key={d.business_id}>
                    <TableCell>
                      <Link to={`/admin/dealerships/${d.business_id}`} className="font-medium hover:underline">
                        {d.business_name}
                      </Link>
                      <div className="text-sm text-muted-foreground">{d.contact_email || '—'}</div>
                    </TableCell>
                    <TableCell>{d.plan_name || <span className="text-muted-foreground">No plan</span>}</TableCell>
                    <TableCell className="tabular text-right">{d.users_count}</TableCell>
                    <TableCell className="tabular text-right">{d.bikes_in_stock}</TableCell>
                    <TableCell className="tabular text-right">{d.bikes_sold}</TableCell>
                    <TableCell className="tabular text-right">{money(d.sale_value)}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(d.status) as any}>{d.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {d.status === 'pending' && (
                          <Button size="sm" onClick={() => setStatus(d.business_id, d.business_name, 'active')}>
                            <CheckCircle className="mr-1 h-4 w-4" /> Approve
                          </Button>
                        )}
                        {d.status === 'active' && (
                          <Button size="sm" variant="outline" onClick={() => setStatus(d.business_id, d.business_name, 'suspended')}>
                            <PauseCircle className="mr-1 h-4 w-4" /> Suspend
                          </Button>
                        )}
                        {d.status === 'suspended' && (
                          <Button size="sm" variant="outline" onClick={() => setStatus(d.business_id, d.business_name, 'active')}>
                            <PlayCircle className="mr-1 h-4 w-4" /> Reactivate
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Panel>
    </div>
  );
}
