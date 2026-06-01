import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import BikeDetailView from '@/components/bike/BikeDetailView';
import BikeForm from '@/components/management/BikeForm';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';

export default function BikeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [bike, setBike] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);

  const fetchBike = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('bikes')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (!error) setBike(data);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchBike();
  }, [fetchBike]);

  if (loading) {
    return (
      <div className="container mx-auto py-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!bike) {
    return (
      <div className="container mx-auto py-6 space-y-4">
        <h1 className="text-2xl font-bold">Bike not found</h1>
        <Button onClick={() => navigate('/bikes')}>Back to bikes</Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <BikeDetailView
        bike={bike}
        onEdit={() => setShowEdit(true)}
        onBack={() => navigate('/bikes')}
        onUpdate={fetchBike}
      />

      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Bike</DialogTitle>
          </DialogHeader>
          <BikeForm
            bike={bike}
            onSuccess={() => {
              setShowEdit(false);
              fetchBike();
            }}
            onCancel={() => setShowEdit(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
