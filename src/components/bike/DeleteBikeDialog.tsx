import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { bikeRef } from '@/lib/bikeReference';

interface DeleteBikeDialogProps {
  bike: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
}

type Counts = {
  jobs: number;
  inspections: number;
  stage_events: number;
  components: number;
  collections: number;
  parts: number;
  photos: number;
  invoices: number;
};

export default function DeleteBikeDialog({ bike, open, onOpenChange, onDeleted }: DeleteBikeDialogProps) {
  const [confirmText, setConfirmText] = useState('');
  const [counts, setCounts] = useState<Counts | null>(null);
  const [blocked, setBlocked] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const reference = bikeRef(bike);

  useEffect(() => {
    if (!open || !bike?.id) return;
    setConfirmText('');
    setBlocked(null);
    setCounts(null);
    setLoading(true);
    (async () => {
      const { data, error } = await supabase.functions.invoke('delete-bike', {
        body: { bike_id: bike.id, dry_run: true },
      });
      setLoading(false);
      const payload: any = data ?? (error as any)?.context ?? null;
      if (payload?.counts) setCounts(payload.counts as Counts);
      if (payload?.error === 'blocked_by_invoice') {
        setBlocked(payload.message);
        return;
      }
      if (error && !payload?.counts) {
        // Fall back to a direct invoice check so the dialog still reports state
        const { count } = await supabase
          .from('invoices')
          .select('id', { count: 'exact', head: true })
          .eq('bike_id', bike.id);
        if (count && count > 0) setBlocked(`This bike has ${count} linked invoice(s). Cancel or unlink them first.`);
      }
    })();
  }, [open, bike?.id]);

  const handleDelete = async () => {
    setDeleting(true);
    const { data, error } = await supabase.functions.invoke('delete-bike', {
      body: { bike_id: bike.id },
    });
    setDeleting(false);
    const payload: any = data ?? null;
    if (error || !payload?.ok) {
      const message = payload?.message || payload?.error || error?.message || 'Delete failed';
      if (payload?.error === 'blocked_by_invoice') setBlocked(payload.message);
      toast({ title: 'Could not delete bike', description: message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Bike deleted', description: `${reference} and all associated data were removed.` });
    onOpenChange(false);
    onDeleted();
  };

  const rows = counts
    ? [
        ['Photos', counts.photos],
        ['Workshop / detailing jobs', counts.jobs],
        ['Inspections', counts.inspections],
        ['Stage history entries', counts.stage_events],
        ['Fitted components', counts.components],
        ['Collection bookings', counts.collections],
        ['Parts rows linked to this bike', counts.parts],
      ].filter(([, n]) => Number(n) > 0)
    : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Delete bike permanently</DialogTitle>
          <DialogDescription>
            This removes {bike?.make} {bike?.model} and everything attached to it. This cannot be undone.
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Checking linked records…
          </div>
        )}

        {blocked && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{blocked}</AlertDescription>
          </Alert>
        )}

        {!blocked && !loading && (
          <>
            {rows.length > 0 ? (
              <div className="rounded-md border p-3 text-sm space-y-1">
                <p className="font-medium mb-1">Will be deleted:</p>
                {rows.map(([label, n]) => (
                  <div key={String(label)} className="flex justify-between text-muted-foreground">
                    <span>{label}</span>
                    <span className="font-mono">{n}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No linked records found for this bike.</p>
            )}

            <div className="space-y-2">
              <Label htmlFor="confirm-ref">
                Type <span className="font-mono font-semibold">{reference}</span> to confirm
              </Label>
              <Input
                id="confirm-ref"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={reference}
                autoComplete="off"
              />
            </div>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={deleting}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={
              deleting ||
              loading ||
              !!blocked ||
              confirmText.trim().toUpperCase() !== String(reference).toUpperCase()
            }
          >
            {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Delete permanently
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
