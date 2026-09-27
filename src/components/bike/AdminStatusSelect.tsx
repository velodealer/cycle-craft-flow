import { useEffect, useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { openWorkshopJobs, type OpenJob } from '@/lib/deferredJobs';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { reverseSale } from '@/lib/quickbooks';
import { logActivity } from '@/lib/activity';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { syncShopifyQuietly } from '@/services/shopify';
import { syncSquarespaceQuietly } from '@/services/squarespace';
import { syncEbayQuietly } from '@/services/ebay';
import { ensureInspectionQuietly } from '@/services/inspectabike';
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
  const [jobs, setJobs] = useState<{ blocking: OpenJob[]; deferred: OpenJob[] } | null>(null);
  const [overrideReason, setOverrideReason] = useState('');
  useEffect(() => {
    setJobs(null); setOverrideReason('');
    if (!pending) return;
    openWorkshopJobs(bike.id).then(setJobs).catch(() => setJobs({ blocking: [], deferred: [] }));
  }, [pending, bike.id]);
  const listingGate = pending === 'ready' || pending === 'listed';
  const handoverGate = pending === 'collected' || pending === 'delivered';
  const blockedListing = listingGate && !!jobs && jobs.blocking.length > 0;
  const needsOverride = handoverGate && !!jobs && jobs.deferred.length > 0;
  const gateBlocked = (listingGate || handoverGate) && !jobs || blockedListing || (needsOverride && !overrideReason.trim());

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

      if (pending === 'ready' || pending === 'listed') {
        void syncShopifyQuietly(bike.id, 'list');
        void syncEbayQuietly(bike.id, 'list');
      } else if (['sold', 'split_for_parts', 'delivered', 'collected'].includes(pending)) {
        void syncShopifyQuietly(bike.id, 'sold_out');
        void syncSquarespaceQuietly(bike.id, 'sold_out');
        void syncEbayQuietly(bike.id, 'end');
      }

      if (pending === 'inspection') {
        void ensureInspectionQuietly(bike.id);
      }


      logActivity(bike.id, {
        kind: 'status_change',
        action: 'status',
        summary: `Status changed from ${labelFor(bike.status)} to ${labelFor(pending)}`,
        detail: { from: bike.status, to: pending, deferred_override: needsOverride ? { reason: overrideReason.trim(), jobs: jobs?.deferred.map((j) => j.title) } : undefined },
        actorId: profile?.id ?? null,
      });

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
          {blockedListing && jobs && (
            <div className="space-y-1 rounded-md border border-border p-3 text-sm">
              <p className="font-medium text-destructive">{jobs.blocking.length} workshop job{jobs.blocking.length === 1 ? '' : 's'} still open</p>
              <ul className="list-disc pl-5 text-muted-foreground">{jobs.blocking.map((j) => <li key={j.id}>{j.title}</li>)}</ul>
              <p className="text-muted-foreground">Finish them or defer small ones on the Jobs page first.</p>
            </div>
          )}
          {needsOverride && jobs && (
            <div className="space-y-2 rounded-md border border-border p-3 text-sm">
              <p className="font-medium text-destructive">{jobs.deferred.length} deferred job{jobs.deferred.length === 1 ? '' : 's'} not done yet</p>
              <ul className="list-disc pl-5 text-muted-foreground">{jobs.deferred.map((j) => <li key={j.id}>{j.title}</li>)}</ul>
              <Textarea placeholder="Reason for handing over without these jobs (required)" value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} />
            </div>
          )}
          <AlertDialogHeader className="hidden">
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={isReversal ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : undefined}
              onClick={(e) => { e.preventDefault(); applyChange(); }}
              disabled={saving || gateBlocked}
            >
              {saving ? 'Working...' : isReversal ? 'Reverse sale' : 'Change status'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
