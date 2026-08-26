import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const STATUSES: { value: string; label: string }[] = [
  { value: 'pending_intake', label: 'Pending intake' },
  { value: 'awaiting_collection', label: 'Awaiting collection' },
  { value: 'collection_in_progress', label: 'Collection in progress' },
  { value: 'in_transit', label: 'In transit' },
  { value: 'intake', label: 'Intake' },
  { value: 'cleaning', label: 'Cleaning' },
  { value: 'inspection', label: 'Inspection' },
  { value: 'pending_approval', label: 'Awaiting owner approval' },
  { value: 'repair', label: 'Repair' },
  { value: 'ready', label: 'Ready for sale' },
  { value: 'listed', label: 'Listed' },
  { value: 'in_stock', label: 'In stock' },
  { value: 'sold', label: 'Sold' },
  { value: 'split_for_parts', label: 'Split for parts' },
];

// Statuses that map onto a fulfilment_stage enum value for stage history
const FULFILMENT_STAGES = ['intake', 'cleaning', 'inspection', 'repair', 'ready'];

const labelFor = (value: string) =>
  STATUSES.find((s) => s.value === value)?.label ?? value;

interface AdminStatusSelectProps {
  bike: { id: string; status: string };
  onUpdate: () => void;
}

export default function AdminStatusSelect({ bike, onUpdate }: AdminStatusSelectProps) {
  const { profile } = useAuth();
  const [pending, setPending] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const applyChange = async () => {
    if (!pending) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('bikes')
        .update({ status: pending as any })
        .eq('id', bike.id);
      if (error) throw error;

      if (profile?.id && FULFILMENT_STAGES.includes(pending)) {
        const { error: eventError } = await supabase.from('fulfilment_events').insert({
          bike_id: bike.id,
          stage: pending as any,
          notes: `Manual status change: ${labelFor(bike.status)} → ${labelFor(pending)}`,
          performed_by: profile.id,
        });
        if (eventError) console.error('Failed to record fulfilment event', eventError);
      }

      toast({
        title: 'Status updated',
        description: `Bike set to ${labelFor(pending)}`,
      });
      setPending(null);
      onUpdate();
    } catch (e: any) {
      toast({
        title: 'Could not update status',
        description: e.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2">
      <span className="text-sm font-medium">Status (admin override)</span>
      <Select
        value={bike.status}
        onValueChange={(v) => {
          if (v !== bike.status) setPending(v);
        }}
      >
        <SelectTrigger className="w-full sm:w-64">
          <SelectValue placeholder="Select status" />
        </SelectTrigger>
        <SelectContent className="bg-popover z-50">
          {STATUSES.map((s) => (
            <SelectItem key={s.value} value={s.value}>
              {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <AlertDialog open={!!pending} onOpenChange={(open) => !open && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Change status from {labelFor(bike.status)} to {pending ? labelFor(pending) : ''}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This only changes the bike's status. It does not create invoices, QuickBooks
              postings or collection records. Use Record Sale for genuine sales.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); applyChange(); }} disabled={saving}>
              {saving ? 'Saving...' : 'Change status'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
