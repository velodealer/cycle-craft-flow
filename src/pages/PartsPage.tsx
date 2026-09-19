import { useState } from 'react';
import PartList from '@/components/management/PartList';
import PartForm from '@/components/management/PartForm';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PageHeader, Panel } from '@/components/velo/PageShell';

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
    <div>
      <PageHeader
        title="Parts"
        description="Parts stock, suppliers and cost — what's on the shelf and what's fitted."
      />

      <PartList key={refreshKey} onEdit={handleEdit} onAdd={handleAdd} />

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              <span className="font-display">{selectedPart ? 'Edit part' : 'Add part'}</span>
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