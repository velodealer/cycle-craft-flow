import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { AlertTriangle, Check, X } from 'lucide-react';

interface Props {
  bikeId: string;
  onUpdate?: () => void;
}

const fmt = (n: number | null | undefined) => `£${Number(n ?? 0).toFixed(2)}`;

const STATUS_LABEL: Record<string, string> = {
  reported: 'Awaiting approval',
  approved: 'Approved',
  declined: 'Declined',
  awaiting_part: 'Awaiting part',
  repaired: 'Repaired',
};

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  reported: 'destructive',
  approved: 'default',
  declined: 'outline',
  awaiting_part: 'secondary',
  repaired: 'default',
};

export default function InspectionFaults({ bikeId, onUpdate }: Props) {
  const { profile } = useAuth();
  const [faults, setFaults] = useState<any[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const canDecide = !!profile && ['admin', 'owner'].includes(profile.role);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('inspection_faults')
      .select('*')
      .eq('bike_id', bikeId)
      .order('created_at');
    setFaults(data || []);
  }, [bikeId]);

  useEffect(() => { load(); }, [load]);

  const decide = async (fault: any, decision: 'approved' | 'declined') => {
    setBusy(fault.id);
    try {
      const { data, error } = await supabase.functions.invoke('inspectabike-decision', {
        body: { fault_row_id: fault.id, decision, note: notes[fault.id] || undefined },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast({
        title: decision === 'approved' ? 'Fault approved' : 'Fault declined',
        description: decision === 'approved'
          ? 'Parts and labour costs added to this bike.'
          : 'No work will be carried out for this fault.',
      });
      await load();
      onUpdate?.();
    } catch (e: any) {
      toast({ title: 'Could not send decision', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  if (faults.length === 0) return null;

  const totalApproved = faults
    .filter((f) => f.status === 'approved' || f.status === 'awaiting_part' || f.status === 'repaired')
    .reduce((sum, f) => sum + Number(f.parts_cost || 0) + Number(f.labour_cost || 0), 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          Inspection faults
          <Badge variant="secondary" className="ml-auto">{faults.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {faults.map((f) => (
          <div key={f.id} className="rounded-md border p-3 space-y-2">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium break-words">{f.title}</p>
                {f.component && <p className="text-xs text-muted-foreground">{f.component}</p>}
              </div>
              <Badge variant={STATUS_VARIANT[f.status] || 'secondary'}>
                {STATUS_LABEL[f.status] || f.status}
              </Badge>
            </div>

            {f.description && (
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{f.description}</p>
            )}

            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              <span>Parts: <strong>{fmt(f.parts_cost)}</strong></span>
              <span>Labour: <strong>{fmt(f.labour_cost)}</strong></span>
              <span>Total: <strong>{fmt(Number(f.parts_cost || 0) + Number(f.labour_cost || 0))}</strong></span>
            </div>

            {f.decision_note && (
              <p className="text-xs text-muted-foreground">Note: {f.decision_note}</p>
            )}

            {f.status === 'repaired' && f.repaired_at && (
              <p className="text-xs text-muted-foreground">
                Repair completed {new Date(f.repaired_at).toLocaleString()}
              </p>
            )}

            {canDecide && f.status === 'reported' && (
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  placeholder="Optional note"
                  value={notes[f.id] || ''}
                  onChange={(e) => setNotes((n) => ({ ...n, [f.id]: e.target.value }))}
                />
                <div className="flex gap-2">
                  <Button size="sm" disabled={busy === f.id} onClick={() => decide(f, 'approved')}>
                    <Check className="h-4 w-4 mr-1" />Approve
                  </Button>
                  <Button size="sm" variant="outline" disabled={busy === f.id} onClick={() => decide(f, 'declined')}>
                    <X className="h-4 w-4 mr-1" />Decline
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}

        <p className="text-sm">
          Approved work total: <strong>{fmt(totalApproved)}</strong>
        </p>
      </CardContent>
    </Card>
  );
}
