import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import PhotoUpload from '@/components/PhotoUpload';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Sparkles, CheckCircle, Clock, PlayCircle } from 'lucide-react';

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
  const [photosBefore, setPhotosBefore] = useState<string[]>([]);
  const [photosAfter, setPhotosAfter] = useState<string[]>([]);
  const [status, setStatus] = useState<'pending' | 'in_progress' | 'complete'>('pending');
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
        setPhotosBefore(data.photos_before || []);
        setPhotosAfter(data.photos_after || []);
        setStatus(data.status as 'pending' | 'in_progress' | 'complete');
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
          status: 'pending',
          assigned_to: profile?.id,
          checklist: {},
          photos_before: [],
          photos_after: []
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
          status: 'pending',
          assigned_to: profile?.id,
          checklist: checklist,
          photos_before: photosBefore,
          photos_after: photosAfter
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

    setSaving(true);
    try {
      const { error } = await supabase
        .from('jobs')
        .update({
          description: notes,
          status,
          checklist: checklist,
          photos_before: photosBefore,
          photos_after: photosAfter,
          completed_at: status === 'complete' ? new Date().toISOString() : null
        })
        .eq('id', cleaningJob.id);

      if (error) throw error;

      // If marking as complete, move bike to inspection and create fulfilment event
      if (status === 'complete') {
        await handleCompletion();
      }

      toast({
        title: 'Success', 
        description: 'Cleaning task updated'
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

  const getStatusIcon = () => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4" />;
      case 'in_progress':
        return <PlayCircle className="h-4 w-4" />;
      case 'complete':
        return <CheckCircle className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'pending':
        return 'outline';
      case 'in_progress':
        return 'secondary';
      case 'complete':
        return 'default';
      default:
        return 'outline';
    }
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
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Sparkles className="h-5 w-5" />
            <CardTitle>Cleaning Task</CardTitle>
          </div>
          {cleaningJob && (
            <Badge variant={getStatusColor()}>
              {getStatusIcon()}
              <span className="ml-1 capitalize">{status.replace('_', ' ')}</span>
            </Badge>
          )}
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
            {/* Status Selection */}
            <div>
              <label className="text-sm font-medium">Status</label>
              <Select value={status} onValueChange={(value: any) => setStatus(value)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Not Started</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="complete">Complete</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

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

            {/* Save Button */}
            <Button 
              onClick={updateCleaningJob} 
              disabled={saving}
              className="w-full"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>

            {status === 'complete' && (
              <div className="text-sm text-muted-foreground text-center">
                Marking as complete will automatically move the bike to Inspection stage
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}