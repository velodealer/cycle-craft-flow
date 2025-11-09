import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ArrowRight, Edit, ChevronLeft } from 'lucide-react';
import StatusProgressBar from './StatusProgressBar';
import AdvanceStageDialog from './AdvanceStageDialog';
import CleaningTask from './CleaningTask';
import { CollectionStatus } from './CollectionStatus';

interface BikeDetailViewProps {
  bike: any;
  onEdit: () => void;
  onBack: () => void;
  onUpdate: () => void;
  showPhotos?: boolean;
  showPricing?: boolean;
  showDescriptions?: boolean;
}

export default function BikeDetailView({ 
  bike, 
  onEdit, 
  onBack, 
  onUpdate,
  showPhotos = true,
  showPricing = true,
  showDescriptions = true
}: BikeDetailViewProps) {
  const [showAdvanceDialog, setShowAdvanceDialog] = useState(false);

  const getNextStage = (currentStatus: string) => {
    const stageOrder = [
      'intake', 'cleaning', 'inspection', 'pending_approval', 
      'repair', 'ready', 'listed', 'sold'
    ];
    
    const currentIndex = stageOrder.indexOf(currentStatus);
    if (currentIndex >= 0 && currentIndex < stageOrder.length - 1) {
      return stageOrder[currentIndex + 1];
    }
    return null;
  };

  const getStageLabel = (stage: string) => {
    const labels: Record<string, string> = {
      'intake': 'Intake',
      'cleaning': 'Cleaning', 
      'inspection': 'Inspection',
      'pending_approval': 'Awaiting Owner Approval',
      'repair': 'Repair',
      'ready': 'Ready for Sale',
      'listed': 'Listed',
      'sold': 'Sold'
    };
    return labels[stage] || stage;
  };

  const nextStage = getNextStage(bike.status);

  const formatCurrency = (amount: number | null) => {
    return amount ? `£${amount.toFixed(2)}` : '-';
  };

  const getSourceBadge = (source: string) => {
    return (
      <Badge variant={source === 'owned' ? 'default' : 'outline'}>
        {source === 'owned' ? 'Owned by us' : 'Customer consignment'}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
          <Button variant="ghost" size="sm" onClick={onBack} className="w-fit">
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back to List
          </Button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">
              {bike.make} {bike.model}
            </h1>
            <p className="text-muted-foreground text-sm">
              {bike.year && `${bike.year} • `}
              ID: {bike.id.slice(0, 8)}
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:gap-2">
          <Button variant="outline" onClick={onEdit} className="w-full sm:w-auto">
            <Edit className="h-4 w-4 mr-2" />
            Edit Bike
          </Button>
          {nextStage && (
            <Button onClick={() => setShowAdvanceDialog(true)} className="w-full sm:w-auto">
              <ArrowRight className="h-4 w-4 mr-2" />
              Move to {getStageLabel(nextStage)}
            </Button>
          )}
        </div>
      </div>

      {/* Status Progress */}
      <StatusProgressBar currentStatus={bike.status} />

      <Separator />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Make</label>
                  <p className="text-base">{bike.make}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Model</label>
                  <p className="text-base">{bike.model}</p>
                </div>
                {bike.year && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Year</label>
                    <p className="text-base">{bike.year}</p>
                  </div>
                )}
                {bike.size && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Size</label>
                    <p className="text-base">{bike.size}</p>
                  </div>
                )}
                {bike.colour && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Colour</label>
                    <p className="text-base">{bike.colour}</p>
                  </div>
                )}
                {bike.condition && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Condition</label>
                    <p className="text-base">{bike.condition}</p>
                  </div>
                )}
              </div>
              
              {bike.frame_number && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Frame Number</label>
                  <p className="text-base font-mono">{bike.frame_number}</p>
                </div>
              )}
              
              <div>
                <label className="text-sm font-medium text-muted-foreground">Source</label>
                <div className="mt-1">
                  {getSourceBadge(bike.source)}
                </div>
              </div>

              {bike.accessories_included && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Accessories Included</label>
                  <p className="text-base">{bike.accessories_included}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pricing Information */}
          {showPricing && (
            <Card>
              <CardHeader>
                <CardTitle>Pricing & Finance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Purchase Price</label>
                    <p className="text-lg font-semibold">{formatCurrency(bike.purchase_price)}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Asking Price</label>
                    <p className="text-lg font-semibold">{formatCurrency(bike.asking_price)}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Sale Price</label>
                    <p className="text-lg font-semibold">{formatCurrency(bike.sale_price)}</p>
                  </div>
                </div>
                
                <div className="mt-4">
                  <label className="text-sm font-medium text-muted-foreground">VAT Scheme</label>
                  <p className="text-base capitalize">{bike.finance_scheme?.replace('_', ' ') || '-'}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Photos */}
          {showPhotos && bike.photos && bike.photos.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Photos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {bike.photos.map((photo: string, index: number) => (
                    <img
                      key={index}
                      src={photo}
                      alt={`${bike.make} ${bike.model} ${index + 1}`}
                      className="w-full h-32 object-cover rounded-lg border"
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Descriptions */}
          {showDescriptions && (bike.description || bike.listing_description) && (
            <Card>
              <CardHeader>
                <CardTitle>Descriptions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {bike.description && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Internal Notes</label>
                    <p className="text-base whitespace-pre-wrap">{bike.description}</p>
                  </div>
                )}
                {bike.listing_description && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Listing Description</label>
                    <p className="text-base whitespace-pre-wrap">{bike.listing_description}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Tasks & Timeline */}
        <div className="space-y-6">
          {/* Show collection status if bike has collection */}
          <CollectionStatus bikeId={bike.id} onUpdate={onUpdate} />
          
          {/* Show cleaning task if bike is in cleaning status */}
          {bike.status === 'cleaning' && (
            <CleaningTask bike={bike} onUpdate={onUpdate} />
          )}
        </div>
      </div>

      {/* Advance Stage Dialog */}
      {nextStage && (
        <AdvanceStageDialog
          isOpen={showAdvanceDialog}
          onClose={() => setShowAdvanceDialog(false)}
          bike={bike}
          nextStage={nextStage}
          nextStageLabel={getStageLabel(nextStage)}
          onSuccess={onUpdate}
        />
      )}
    </div>
  );
}