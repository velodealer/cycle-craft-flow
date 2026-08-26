import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { PackageCheck, Save } from 'lucide-react';
import IntakeForm from '@/components/intake/IntakeForm';
import LocationSelect from './LocationSelect';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

interface IntakeTaskProps {
  bike: any;
  onUpdate: () => void;
}

export default function IntakeTask({ bike, onUpdate }: IntakeTaskProps) {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const pending = ['pending_intake', 'intake'].includes(bike.status);

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [frameNumber, setFrameNumber] = useState(bike.frame_number || '');
  const [accessories, setAccessories] = useState(bike.accessories_included || '');
  const [photos, setPhotos] = useState<string[]>([]);
  const [serialPhotos, setSerialPhotos] = useState<string[]>([]);
  const [registerPhotos, setRegisterPhotos] = useState<string[]>([]);

  useEffect(() => {
    setFrameNumber(bike.frame_number || '');
    setAccessories(bike.accessories_included || '');
  }, [bike.id, bike.frame_number, bike.accessories_included]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const newPhotos = [...photos, ...serialPhotos, ...registerPhotos];
      const update: Record<string, any> = {
        frame_number: frameNumber.trim() || null,
        accessories_included: accessories.trim() || null,
      };
      if (newPhotos.length > 0) {
        update.photos = [...((bike.photos as string[] | null) || []), ...newPhotos];
      }

      const { error } = await supabase.from('bikes').update(update).eq('id', bike.id);
      if (error) throw error;
      toast({ title: 'Saved', description: 'Intake details updated' });
      setPhotos([]);
      setSerialPhotos([]);
      setRegisterPhotos([]);
      setEditing(false);
      onUpdate();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };


  if (pending) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <PackageCheck className="h-5 w-5" />
              Intake
            </span>
            <Badge variant="secondary">
              {bike.status === 'pending_intake' ? 'Delivered' : 'In progress'}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <IntakeForm
            embedded
            preselectedBikeId={bike.id}
            onSuccess={onUpdate}
            onCancel={() => {}}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <PackageCheck className="h-5 w-5" />
            Intake
          </span>
          <Badge>Completed</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Intake date</span>
            <p>{bike.intake_date ? new Date(bike.intake_date).toLocaleDateString() : '—'}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Source</span>
            <p className="capitalize">{String(bike.source || '').replace(/_/g, ' ') || '—'}</p>
          </div>
          {bike.condition && (
            <div>
              <span className="text-muted-foreground">Condition</span>
              <p>{bike.condition}</p>
            </div>
          )}
        </div>

        {editing ? (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="intake-frame">Frame number</Label>
              <Input
                id="intake-frame"
                value={frameNumber}
                maxLength={100}
                onChange={(e) => setFrameNumber(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="intake-accessories">Accessories included</Label>
              <Textarea
                id="intake-accessories"
                rows={3}
                maxLength={1000}
                value={accessories}
                onChange={(e) => setAccessories(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={saving} className="flex-1">
                <Save className="h-4 w-4 mr-2" />
                Save
              </Button>
              <Button variant="outline" onClick={() => setEditing(false)} disabled={saving}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3 text-sm">
            <div>
              <span className="text-muted-foreground">Frame number</span>
              <p className="font-mono">{bike.frame_number || '—'}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Accessories included</span>
              <p className="whitespace-pre-wrap">{bike.accessories_included || '—'}</p>
            </div>
            {bike.condition_notes && (
              <div>
                <span className="text-muted-foreground">Intake notes</span>
                <p className="whitespace-pre-wrap">{bike.condition_notes}</p>
              </div>
            )}
            {isAdmin && (
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                Edit intake details
              </Button>
            )}
          </div>
        )}

        <div className="space-y-1">
          <span className="text-xs text-muted-foreground">Location</span>
          <LocationSelect bikeId={bike.id} value={bike.storage_bay_id} onChange={() => onUpdate()} size="sm" />
        </div>
      </CardContent>
    </Card>
  );
}
