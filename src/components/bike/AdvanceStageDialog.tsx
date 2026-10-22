import { useEffect, useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { openWorkshopJobs, type OpenJob } from '@/lib/deferredJobs';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import PhotoUpload from '@/components/PhotoUpload';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { syncShopifyQuietly } from '@/services/shopify';
import { syncEbayQuietly } from '@/services/ebay';
import { ensureInspectionQuietly } from '@/services/inspectabike';
import { logActivity } from '@/lib/activity';

const advanceStageSchema = z.object({
  notes: z.string().optional(),
});

interface AdvanceStageDialogProps {
  isOpen: boolean;
  onClose: () => void;
  bike: any;
  nextStage: string;
  nextStageLabel: string;
  onSuccess: () => void;
}

export default function AdvanceStageDialog({ 
  isOpen, 
  onClose, 
  bike, 
  nextStage, 
  nextStageLabel, 
  onSuccess 
}: AdvanceStageDialogProps) {
  const [photos, setPhotos] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const { profile } = useAuth();
  const gated = nextStage === 'ready' || nextStage === 'listed';
  const [jobs, setJobs] = useState<{ blocking: OpenJob[]; deferred: OpenJob[] } | null>(null);
  const [jobsError, setJobsError] = useState<string | null>(null);
  const [ackDeferred, setAckDeferred] = useState(false);
  useEffect(() => {
    if (!isOpen || !gated) return;
    setJobs(null); setJobsError(null); setAckDeferred(false);
    openWorkshopJobs(bike.id).then(setJobs).catch((e) => setJobsError(e.message));
  }, [isOpen, gated, bike.id]);
  const blocked = gated && (!jobs || jobs.blocking.length > 0 || (jobs.deferred.length > 0 && !ackDeferred));

  const form = useForm<z.infer<typeof advanceStageSchema>>({
    resolver: zodResolver(advanceStageSchema),
    defaultValues: {
      notes: '',
    },
  });

  const onSubmit = async (values: z.infer<typeof advanceStageSchema>) => {
    if (!profile) {
      toast({
        title: 'Error',
        description: 'You must be logged in to advance stages',
        variant: 'destructive',
      });
      return;
    }

    if (blocked) return;
    setSubmitting(true);
    try {
      // One server step: stage, photos, history and stage note together.
      const note = values.notes?.trim() || '';
      const { error: stageError } = await supabase.rpc('change_bike_stage' as any, {
        _bike_id: bike.id,
        _status: nextStage,
        _summary: `Moved to ${nextStageLabel}`,
        _note: note || null,
        _photos: photos.length ? photos : null,
        _fulfilment_note: [note, photos.length ? `${photos.length} photo(s) added at this stage.` : ''].filter(Boolean).join('\n\n') || null,
      });
      if (stageError) throw stageError;

      if (nextStage === 'ready' || nextStage === 'listed') {
        void syncShopifyQuietly(bike.id, 'list');
        void syncEbayQuietly(bike.id, 'list');
      }
      if (nextStage === 'inspection') {
        void ensureInspectionQuietly(bike.id);
      }

      toast({
        title: 'Stage Updated',
        description: `Bike moved to ${nextStageLabel}`,
      });

      onSuccess();
      onClose();
      form.reset();
      setPhotos([]);

    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    onClose();
    form.reset();
    setPhotos([]);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Move to {nextStageLabel}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder={`Add notes about moving to ${nextStageLabel}...`}
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div>
              <FormLabel>Photos (Optional)</FormLabel>
              <PhotoUpload
                bucket="bike-photos"
                path={`bike-${bike.id}/stage-${nextStage}`}
                photos={photos}
                onChange={setPhotos}
                maxPhotos={5}
              />
            </div>

            {gated && (
              <div className="space-y-2 rounded-md border border-border p-3 text-sm">
                {jobsError ? <p className="text-destructive">{jobsError}</p>
                  : !jobs ? <p className="text-muted-foreground">Checking workshop jobs…</p>
                  : jobs.blocking.length > 0 ? (
                    <>
                      <p className="font-medium text-destructive">{jobs.blocking.length} workshop job{jobs.blocking.length === 1 ? '' : 's'} still open</p>
                      <ul className="list-disc pl-5 text-muted-foreground">{jobs.blocking.map((j) => <li key={j.id}>{j.title}</li>)}</ul>
                      <p className="text-muted-foreground">Finish these, or ask an owner/admin to defer small ones on the Jobs page.</p>
                    </>
                  ) : jobs.deferred.length > 0 ? (
                    <>
                      <p className="font-medium">{jobs.deferred.length} deferred job{jobs.deferred.length === 1 ? '' : 's'} — to be done before handover</p>
                      <ul className="list-disc pl-5 text-muted-foreground">{jobs.deferred.map((j) => <li key={j.id}>{j.title}{j.deferred_reason ? ` — ${j.deferred_reason}` : ''}</li>)}</ul>
                      <label className="flex items-center gap-2"><Checkbox checked={ackDeferred} onCheckedChange={(v) => setAckDeferred(v === true)} /> Listing with {jobs.deferred.length} deferred job{jobs.deferred.length === 1 ? '' : 's'}</label>
                    </>
                  ) : <p className="text-muted-foreground">All workshop jobs done.</p>}
              </div>
            )}

            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting || blocked}>
                {submitting ? 'Updating...' : `Move to ${nextStageLabel}`}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}