import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Building2, Users, CheckCircle, PauseCircle, PlayCircle, Plus } from 'lucide-react';

interface Business {
  id: string;
  name: string;
  contact_email: string | null;
  status: 'pending' | 'active' | 'suspended';
  created_at: string;
}

interface ProfileRow {
  id: string;
  user_id: string;
  name: string;
  email: string;
  role: string;
  business_id: string;
}

const statusVariant = (status: string) =>
  status === 'active' ? 'default' : status === 'pending' ? 'secondary' : 'destructive';

export default function SuperAdminPanel() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [superAdminIds, setSuperAdminIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [newBusinessName, setNewBusinessName] = useState('');
  const [creating, setCreating] = useState(false);
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    const [{ data: b, error: be }, { data: p, error: pe }, { data: sa }] = await Promise.all([
      supabase.from('businesses').select('*').order('created_at', { ascending: true }),
      supabase.from('profiles').select('*').order('created_at', { ascending: true }),
      supabase.from('super_admins').select('user_id'),
    ]);
    if (be || pe) {
      toast({ title: 'Error loading super admin data', description: (be || pe)?.message, variant: 'destructive' });
    }
    setBusinesses((b as Business[]) || []);
    setProfiles((p as ProfileRow[]) || []);
    setSuperAdminIds(new Set((sa || []).map((r: any) => r.user_id)));
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const setStatus = async (business: Business, status: Business['status']) => {
    const { error } = await supabase.from('businesses').update({ status }).eq('id', business.id);
    if (error) {
      toast({ title: 'Could not update business', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: `${business.name} is now ${status}` });
      load();
    }
  };

  const moveUser = async (profile: ProfileRow, businessId: string) => {
    if (businessId === profile.business_id) return;
    const { error } = await supabase.from('profiles').update({ business_id: businessId }).eq('id', profile.id);
    if (error) {
      toast({ title: 'Could not move user', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: `${profile.name} moved` });
      load();
    }
  };

  const createBusiness = async () => {
    if (!newBusinessName.trim()) return;
    setCreating(true);
    const { error } = await supabase
      .from('businesses')
      .insert({ name: newBusinessName.trim(), status: 'active' });
    setCreating(false);
    if (error) {
      toast({ title: 'Could not create business', description: error.message, variant: 'destructive' });
    } else {
      setNewBusinessName('');
      load();
    }
  };

  const businessName = (id: string) => businesses.find((b) => b.id === id)?.name ?? 'Unknown';
  const memberCount = (id: string) => profiles.filter((p) => p.business_id === id).length;

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Businesses
          </CardTitle>
          <CardDescription>
            Approve new business sign-ups, suspend accounts, and see every business on the system.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Business</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Members</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {businesses.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">{b.name}</TableCell>
                    <TableCell>{b.contact_email || '—'}</TableCell>
                    <TableCell>{memberCount(b.id)}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(b.status) as any}>{b.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {b.status === 'pending' && (
                          <Button size="sm" onClick={() => setStatus(b, 'active')}>
                            <CheckCircle className="h-4 w-4 mr-1" /> Approve
                          </Button>
                        )}
                        {b.status === 'active' && (
                          <Button size="sm" variant="outline" onClick={() => setStatus(b, 'suspended')}>
                            <PauseCircle className="h-4 w-4 mr-1" /> Suspend
                          </Button>
                        )}
                        {b.status === 'suspended' && (
                          <Button size="sm" variant="outline" onClick={() => setStatus(b, 'active')}>
                            <PlayCircle className="h-4 w-4 mr-1" /> Reactivate
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-end gap-2">
            <div className="space-y-1 flex-1 max-w-xs">
              <Label htmlFor="new-business">New business</Label>
              <Input
                id="new-business"
                placeholder="Business name"
                value={newBusinessName}
                onChange={(e) => setNewBusinessName(e.target.value)}
              />
            </div>
            <Button onClick={createBusiness} disabled={creating || !newBusinessName.trim()}>
              <Plus className="h-4 w-4 mr-1" /> Create
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            All users
          </CardTitle>
          <CardDescription>
            Every user across every business. Move a user to a different business here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Business</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {profiles.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="font-medium">
                        {p.name}
                        {superAdminIds.has(p.user_id) && (
                          <Badge variant="destructive" className="ml-2">super admin</Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">{p.email}</div>
                    </TableCell>
                    <TableCell className="capitalize">{p.role}</TableCell>
                    <TableCell>
                      <Select value={p.business_id} onValueChange={(v) => moveUser(p, v)}>
                        <SelectTrigger className="w-56">
                          <SelectValue>{businessName(p.business_id)}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {businesses.map((b) => (
                            <SelectItem key={b.id} value={b.id}>
                              {b.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
