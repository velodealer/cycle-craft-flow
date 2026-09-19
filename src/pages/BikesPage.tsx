import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BikeList from '@/components/management/BikeList';
import BikeForm from '@/components/management/BikeForm';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PageHeader, Panel } from '@/components/velo/PageShell';

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
    <div>
      <PageHeader
        title="Bikes"
        description="Every bike in the book — stage, location, price and margin."
      />

      <BikeList
        key={refreshKey}
        onEdit={handleView}
        onAdd={handleAdd}
      />

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">Add bike</DialogTitle>
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
