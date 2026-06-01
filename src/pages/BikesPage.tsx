import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BikeList from '@/components/management/BikeList';
import BikeForm from '@/components/management/BikeForm';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export default function BikesPage() {
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleView = (bike: any) => {
    navigate(`/bikes/${bike.id}`);
  };

  const handleAdd = () => {
    setShowForm(true);
  };

  const handleSuccess = () => {
    setShowForm(false);
    setRefreshKey(prev => prev + 1);
  };

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
            <DialogTitle>Add New Bike</DialogTitle>
          </DialogHeader>
          <BikeForm
            bike={null}
            onSuccess={handleSuccess}
            onCancel={() => setShowForm(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
