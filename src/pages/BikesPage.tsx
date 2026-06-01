import { useState } from 'react';
import BikeList from '@/components/management/BikeList';
import BikeForm from '@/components/management/BikeForm';
import BikeDetailView from '@/components/bike/BikeDetailView';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';

export default function BikesPage() {
  const [selectedBike, setSelectedBike] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleEdit = (bike: any) => {
    setSelectedBike(bike);
    setShowDetail(false);
    setShowForm(true);
  };

  const handleView = (bike: any) => {
    setSelectedBike(bike);
    setShowDetail(true);
  };

  const handleAdd = () => {
    setSelectedBike(null);
    setShowForm(true);
  };

  const handleSuccess = () => {
    setShowForm(false);
    setShowDetail(false);
    setSelectedBike(null);
    setRefreshKey(prev => prev + 1);
  };

  const handleCancel = () => {
    setShowForm(false);
    setSelectedBike(null);
  };

  const handleBackToList = () => {
    setShowDetail(false);
    setSelectedBike(null);
  };

  const handleUpdate = async () => {
    setRefreshKey(prev => prev + 1);
    if (selectedBike?.id) {
      const { data, error } = await supabase
        .from('bikes')
        .select('*')
        .eq('id', selectedBike.id)
        .maybeSingle();
      if (!error && data) {
        setSelectedBike(data);
      }
    }
  };

  if (showDetail && selectedBike) {
    return (
      <div className="container mx-auto py-6">
        <BikeDetailView
          bike={selectedBike}
          onEdit={() => handleEdit(selectedBike)}
          onBack={handleBackToList}
          onUpdate={handleUpdate}
        />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Bike Management</h1>
        <p className="text-muted-foreground">Manage your bicycle inventory and tracking</p>
      </div>

      <BikeList 
        key={refreshKey} 
        onEdit={handleView} 
        onAdd={handleAdd} 
      />

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedBike ? 'Edit Bike' : 'Add New Bike'}
            </DialogTitle>
          </DialogHeader>
          <BikeForm
            bike={selectedBike}
            onSuccess={handleSuccess}
            onCancel={handleCancel}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}