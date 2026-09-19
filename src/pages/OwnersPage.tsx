import { useState } from 'react';
import OwnerList from '@/components/management/OwnerList';
import OwnerForm from '@/components/management/OwnerForm';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PageHeader, Panel } from '@/components/velo/PageShell';

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
    <div>
      <PageHeader
        title="Owners"
        description="Customers and consignors, their bikes with you and what's settled."
      />

      <OwnerList key={refreshKey} onEdit={handleEdit} onAdd={handleAdd} />

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              <span className="font-display">{selectedOwner ? 'Edit owner' : 'Add owner'}</span>
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