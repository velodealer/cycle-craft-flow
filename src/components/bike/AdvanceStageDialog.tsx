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
      // Update bike status
      const { error: bikeError } = await supabase
        .from('bikes')
        .update({ status: nextStage as any })
        .eq('id', bike.id);

      if (bikeError) throw bikeError;

      // Create fulfilment event  
      const { error: eventError } = await supabase
        .from('fulfilment_events')
        .insert({
          bike_id: bike.id,
          stage: nextStage as any,
          performed_by: profile.user_id,
          notes: values.notes || null,
          timestamp: new Date().toISOString(),
        });

      if (eventError) throw eventError;

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
                bucket="fulfilment-photos"
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