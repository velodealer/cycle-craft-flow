import { useEffect, useState } from 'react';
import { PackageCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { logActivity } from '@/lib/activity';
import { openWorkshopJobs, type OpenJob } from '@/lib/deferredJobs';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface Props {
  bike: { id: string; status: string; delivery_method?: string | null };
  onUpdate: () => void;
}

/** Final after-sale step: mark a sold bike as collected by the customer or delivered. */
export default function HandoverButton({ bike, onUpdate }: Props) {
  const { profile } = useAuth();
  const target = bike.delivery_method === 'delivery' ? 'delivered' : 'collected';
  const label = target === 'delivered' ? 'Delivered' : 'Collected';
  const [open, setOpen] = useState(false);
  const [jobs, setJobs] = useState<OpenJob[] | null>(null);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const canOverride = profile?.role === 'admin' || profile?.role === 'owner';

  useEffect(() => {
    if (!open) return;
    setJobs(null); setReason('');
    openWorkshopJobs(bike.id).then((r) => setJobs(r.deferred)).catch(() => setJobs([]));
  }, [open, bike.id]);

  if (bike.status !== 'sold') return null;

  const needsReason = !!jobs && jobs.length > 0;
  const blocked = !jobs || (needsReason && (!canOverride || !reason.trim()));

  const confirm = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.rpc('change_bike_stage' as any, {
        _bike_id: bike.id, _status: target, _summary: `Handed over: ${label.toLowerCase()}`,
        _override_reason: needsReason ? reason.trim() : null, _action: 'status',
      });
      if (error) throw error;
      toast({ title: `Marked as ${label.toLowerCase()}` });
      setOpen(false);
      onUpdate();
    } catch (e: any) {
      toast({ title: 'Could not update', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Button onClick={() => setOpen(true)} className="w-full sm:w-auto">
        <PackageCheck className="h-4 w-4 mr-2" />
        Mark as {label.toLowerCase()}
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark this bike as {label.toLowerCase()}?</AlertDialogTitle>
            <AlertDialogDescription>
              {target === 'delivered'
                ? 'Confirms the bike has reached the customer.'
                : 'Confirms the customer has collected the bike.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {needsReason && (
            <div className="space-y-2 rounded-md border border-border p-3 text-sm">
              <p className="font-medium text-destructive">{jobs!.length} deferred job{jobs!.length === 1 ? '' : 's'} not done yet</p>
              <ul className="list-disc pl-5 text-muted-foreground">{jobs!.map((j) => <li key={j.id}>{j.title}</li>)}</ul>
              {canOverride ? (
                <Textarea placeholder="Reason for handing over without these jobs (required)" value={reason} onChange={(e) => setReason(e.target.value)} />
              ) : (
                <p className="text-muted-foreground">Finish these jobs first, or ask an owner or admin to hand over.</p>
              )}
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); confirm(); }} disabled={saving || blocked}>
              {saving ? 'Saving...' : `Mark as ${label.toLowerCase()}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
