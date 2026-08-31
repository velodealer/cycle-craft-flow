import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { reverseSale } from '@/lib/quickbooks';

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
  { value: 'collected', label: 'Collected' },
  { value: 'in_transit', label: 'In transit' },
  { value: 'delivered', label: 'Delivered' },

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

  const isReversal = bike.status === 'sold' && pending !== null && pending !== 'sold';

  const applyChange = async () => {
    if (!pending) return;
    setSaving(true);
    try {
      if (isReversal) {
        const result = await reverseSale({ bikeId: bike.id, newStatus: pending });
        toast({
          title: 'Sale reversed',
          description: `${result.invoices_deleted} invoice(s) deleted${
            result.part_exchange_bikes_deleted
              ? `, ${result.part_exchange_bikes_deleted} part-exchange bike(s) removed`
              : ''
          }. Bike set to ${labelFor(pending)}.`,
        });
        setPending(null);
        onUpdate();
        return;
      }

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
        title: isReversal ? 'Could not reverse the sale' : 'Could not update status',
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
              {isReversal
                ? `Reverse this sale and set the bike to ${pending ? labelFor(pending) : ''}?`
                : `Change status from ${labelFor(bike.status)} to ${pending ? labelFor(pending) : ''}?`}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              {isReversal ? (
                <div className="space-y-2 text-sm">
                  <p>This undoes the sale completely:</p>
                  <ul className="list-disc space-y-1 pl-5">
                    <li>The sale invoice is deleted.</li>
                    <li>The QuickBooks invoice is voided and the stock-out journal deleted.</li>
                    <li>Any part-exchange bike taken in on the sale is deleted, along with its stock posting.</li>
                    <li>The sale price and sold date are cleared and any booked delivery is cancelled.</li>
                  </ul>
                  <p>If QuickBooks cannot be reversed, nothing is deleted and you can retry.</p>
                </div>
              ) : (
                <span>
                  This only changes the bike's status. It does not create invoices, QuickBooks
                  postings or collection records. Use Record Sale for genuine sales.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={isReversal ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : undefined}
              onClick={(e) => { e.preventDefault(); applyChange(); }}
              disabled={saving}
            >
              {saving ? 'Working...' : isReversal ? 'Reverse sale' : 'Change status'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
