import { useState } from 'react';
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

    setSubmitting(true);
    try {
      const update: Record<string, any> = { status: nextStage };

      if (photos.length > 0) {
        const { data: current } = await supabase
          .from('bikes')
          .select('photos')
          .eq('id', bike.id)
          .maybeSingle();
        update.photos = [...((current?.photos as string[] | null) || []), ...photos];
      }

      // Update bike status (and attach any photos taken at this stage)
      const { error: bikeError } = await supabase
        .from('bikes')
        .update(update)
        .eq('id', bike.id);

      if (bikeError) throw bikeError;

      // Record a fulfilment event so notes/photos aren't lost
      const FULFILMENT_STAGES = ['intake', 'cleaning', 'inspection', 'repair', 'ready'];
      if (FULFILMENT_STAGES.includes(nextStage)) {
        const noteParts = [values.notes?.trim() || ''];
        if (photos.length > 0) {
          noteParts.push(`${photos.length} photo(s) added at this stage.`);
        }
        const notes = noteParts.filter(Boolean).join('\n\n');

        const { error: eventError } = await supabase.from('fulfilment_events').insert({
          bike_id: bike.id,
          stage: nextStage as any,
          notes: notes || null,
          performed_by: profile.id,
        });
        if (eventError) console.error('Failed to record fulfilment event', eventError);
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

            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Updating...' : `Move to ${nextStageLabel}`}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}