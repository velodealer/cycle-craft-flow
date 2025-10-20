import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Sparkles, CheckCircle } from 'lucide-react';

interface CleaningTaskProps {
  bike: any;
  onUpdate: () => void;
}

const CLEANING_CHECKLIST = [
  { key: 'wash', label: 'Wash' },
  { key: 'degrease_drivetrain', label: 'Degrease & Drivetrain Clean' },
  { key: 'polish_detail', label: 'Polish/Detail' }
];

export default function CleaningTask({ bike, onUpdate }: CleaningTaskProps) {
  const { profile } = useAuth();
  const [cleaningJob, setCleaningJob] = useState<any>(null);
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Only show for detailers and admins
  if (!profile || !['detailer', 'admin'].includes(profile.role)) {
    return null;
  }

  useEffect(() => {
    loadCleaningJob();
  }, [bike.id]);

  const loadCleaningJob = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('bike_id', bike.id)
        .eq('type', 'detailing')
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setCleaningJob(data);
        setChecklist((data.checklist as Record<string, boolean>) || {});
        setNotes(data.description || '');
      } else {
        // Auto-create cleaning job if it doesn't exist
        await createCleaningJobOnLoad();
      }
    } catch (error) {
      console.error('Error loading cleaning job:', error);
      toast({
        title: 'Error',
        description: 'Failed to load cleaning task',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const createCleaningJobOnLoad = async () => {
    try {
      const { data, error } = await supabase
        .from('jobs')
        .insert({
          bike_id: bike.id,
          type: 'detailing',
          title: `Cleaning - ${bike.make} ${bike.model}`,
          description: '',
          status: 'in_progress',
          assigned_to: profile?.id,
          checklist: {},
        })
        .select()
        .single();

      if (error) throw error;

      setCleaningJob(data);
    } catch (error) {
      console.error('Error auto-creating cleaning job:', error);
    }
  };

  const createCleaningJob = async () => {
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('jobs')
        .insert({
          bike_id: bike.id,
          type: 'detailing',
          title: `Cleaning - ${bike.make} ${bike.model}`,
          description: notes,
          status: 'in_progress',
          assigned_to: profile?.id,
          checklist: checklist,
        })
        .select()
        .single();

      if (error) throw error;

      setCleaningJob(data);
      toast({
        title: 'Success',
        description: 'Cleaning task created'
      });
    } catch (error) {
      console.error('Error creating cleaning job:', error);
      toast({
        title: 'Error',
        description: 'Failed to create cleaning task',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const updateCleaningJob = async () => {
    if (!cleaningJob) return;

    // Check if all checklist items are complete
    const allComplete = CLEANING_CHECKLIST.every(item => checklist[item.key]);

    setSaving(true);
    try {
      const { error } = await supabase
        .from('jobs')
        .update({
          description: notes,
          status: allComplete ? 'complete' : 'in_progress',
          checklist: checklist,
          completed_at: allComplete ? new Date().toISOString() : null
        })
        .eq('id', cleaningJob.id);

      if (error) throw error;

      // If all items complete, move bike to inspection
      if (allComplete) {
        await handleCompletion();
      }

      toast({
        title: 'Success', 
        description: allComplete ? 'Cleaning completed - bike moved to inspection' : 'Cleaning task updated'
      });
      
      onUpdate();
    } catch (error) {
      console.error('Error updating cleaning job:', error);
      toast({
        title: 'Error',
        description: 'Failed to update cleaning task',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCompletion = async () => {
    try {
      // Move bike to inspection stage
      const { error: bikeError } = await supabase
        .from('bikes')
        .update({ status: 'inspection' })
        .eq('id', bike.id);

      if (bikeError) throw bikeError;

    } catch (error) {
      console.error('Error handling completion:', error);
      throw error;
    }
  };

  const handleChecklistChange = (key: string, checked: boolean) => {
    setChecklist(prev => ({ ...prev, [key]: checked }));
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Loading cleaning task...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center space-x-2">
          <Sparkles className="h-5 w-5" />
          <CardTitle>Cleaning Task</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {loading ? (
          <div className="text-center py-8">Loading cleaning task...</div>
        ) : !cleaningJob ? (
          <div className="text-center py-8">
            <Sparkles className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Creating cleaning task...</p>
          </div>
        ) : (
          <>
            {/* Cleaning Checklist */}
            <div>
              <h4 className="font-medium mb-3">Cleaning Checklist</h4>
              <div className="space-y-2">
                {CLEANING_CHECKLIST.map((item) => (
                  <div key={item.key} className="flex items-center space-x-2">
                    <Checkbox
                      checked={checklist[item.key] || false}
                      onCheckedChange={(checked) => handleChecklistChange(item.key, !!checked)}
                    />
                    <label className="text-sm">{item.label}</label>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Notes */}
            <div>
              <label className="text-sm font-medium">Notes</label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any notes about the cleaning process..."
                className="mt-1"
                rows={3}
              />
            </div>

            <Separator />

            <Button 
              onClick={updateCleaningJob} 
              disabled={saving}
              className="w-full"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>

            {CLEANING_CHECKLIST.every(item => checklist[item.key]) && (
              <div className="text-sm text-muted-foreground text-center">
                All tasks complete! Saving will automatically move the bike to Inspection stage
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}