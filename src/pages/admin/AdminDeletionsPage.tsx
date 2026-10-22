import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/velo/PageShell';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

type Row = { id: string; business_id: string; requester_email: string | null; reason: string | null; status: string; created_at: string; decided_at: string | null; decision_note: string | null };

export default function AdminDeletionsPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});

  const load = async () => {
    const [{ data }, { data: biz }] = await Promise.all([
      supabase.from('data_deletion_requests' as any).select('*').order('created_at', { ascending: false }),
      supabase.from('businesses').select('id, name'),
    ]);
    setRows((data as any) ?? []);
    setNames(Object.fromEntries(((biz as any[]) ?? []).map((b) => [b.id, b.name])));
  };
  useEffect(() => { load(); }, []);

  const decide = async (r: Row, status: 'approved' | 'rejected') => {
    const msg = status === 'approved'
      ? `Approve deleting ${names[r.business_id] ?? 'this dealership'}? Everyone there loses access immediately.`
      : 'Reject this request?';
    if (!confirm(msg)) return;
    const note = prompt('Note for the dealer (optional)') ?? null;
    const { error } = await supabase.from('data_deletion_requests' as any).update({ status, decision_note: note || null }).eq('id', r.id);
    if (error) return toast({ title: 'Could not save', description: error.message, variant: 'destructive' });
    toast({ title: status === 'approved' ? 'Approved — dealership locked' : 'Rejected' });
    load();
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Deletion requests" description="Dealerships asking for their account and data to be deleted. Approving locks them out straight away." />
      {rows.length === 0 && <p className="text-sm text-muted-foreground">No requests.</p>}
      {rows.map((r) => (
        <Card key={r.id}>
          <CardContent className="flex flex-col gap-2 p-4 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{names[r.business_id] ?? 'Unknown dealership'}</span>
                <Badge variant={r.status === 'pending' ? 'outline' : r.status === 'approved' ? 'destructive' : 'secondary'}>{r.status}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">{r.requester_email} · {new Date(r.created_at).toLocaleString('en-GB')}</p>
              {r.reason && <p className="text-sm">“{r.reason}”</p>}
              {r.decision_note && <p className="text-sm text-muted-foreground">Note: {r.decision_note}</p>}
            </div>
            {r.status === 'pending' && (
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => decide(r, 'rejected')}>Reject</Button>
                <Button variant="destructive" onClick={() => decide(r, 'approved')}>Approve</Button>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
