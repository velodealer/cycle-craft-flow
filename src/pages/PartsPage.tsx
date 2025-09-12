import { useState } from 'react';
import PartList from '@/components/management/PartList';
import PartForm from '@/components/management/PartForm';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export default function PartsPage() {
  const [selectedPart, setSelectedPart] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleEdit = (part: any) => {
    setSelectedPart(part);
    setShowForm(true);
  };

  const handleAdd = () => {
    setSelectedPart(null);
    setShowForm(true);
  };

  const handleSuccess = () => {
    setShowForm(false);
    setSelectedPart(null);
    setRefreshKey(prev => prev + 1);
  };

  const handleCancel = () => {
    setShowForm(false);
    setSelectedPart(null);
  };

  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Parts Management</h1>
        <p className="text-muted-foreground">Track parts inventory and pricing</p>
      </div>

      <PartList key={refreshKey} onEdit={handleEdit} onAdd={handleAdd} />

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedPart ? 'Edit Part' : 'Add New Part'}
            </DialogTitle>
          </DialogHeader>
          <PartForm
            part={selectedPart}
            onSuccess={handleSuccess}
            onCancel={handleCancel}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}