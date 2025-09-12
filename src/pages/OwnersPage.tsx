import { useState } from 'react';
import OwnerList from '@/components/management/OwnerList';
import OwnerForm from '@/components/management/OwnerForm';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export default function OwnersPage() {
  const [selectedOwner, setSelectedOwner] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleEdit = (owner: any) => {
    setSelectedOwner(owner);
    setShowForm(true);
  };

  const handleAdd = () => {
    setSelectedOwner(null);
    setShowForm(true);
  };

  const handleSuccess = () => {
    setShowForm(false);
    setSelectedOwner(null);
    setRefreshKey(prev => prev + 1);
  };

  const handleCancel = () => {
    setShowForm(false);
    setSelectedOwner(null);
  };

  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Owner Management</h1>
        <p className="text-muted-foreground">Manage customer relationships and contact information</p>
      </div>

      <OwnerList key={refreshKey} onEdit={handleEdit} onAdd={handleAdd} />

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selectedOwner ? 'Edit Owner' : 'Add New Owner'}
            </DialogTitle>
          </DialogHeader>
          <OwnerForm
            owner={selectedOwner}
            onSuccess={handleSuccess}
            onCancel={handleCancel}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}