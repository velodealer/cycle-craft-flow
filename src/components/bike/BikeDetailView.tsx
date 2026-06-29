import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ArrowRight, ArrowLeft, Edit, ChevronLeft } from 'lucide-react';
import StatusProgressBar from './StatusProgressBar';
import AdvanceStageDialog from './AdvanceStageDialog';
import CleaningTask from './CleaningTask';
import { CollectionStatus } from './CollectionStatus';
import { useAuth } from '@/hooks/useAuth';

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
  const [dialogDirection, setDialogDirection] = useState<'forward' | 'back' | null>(null);
  const { profile } = useAuth();
  const isMechanic = profile?.role === 'mechanic';
  const canSeePricing = showPricing && !isMechanic;

  const allStages = (hasCollection: boolean = true) => {
    // Build a single ordered list; we don't know if a collection exists here without a query,
    // but status values are unique across both lists so reverse-lookup works on the union.
    return [
      'awaiting_collection', 'in_transit', 'pending_intake',
      'intake', 'cleaning', 'inspection', 'pending_approval',
      'repair', 'ready', 'listed', 'sold',
    ];
  };

  const getNextStage = (currentStatus: string) => {
    const stages = allStages();
    const i = stages.indexOf(currentStatus);
    if (i >= 0 && i < stages.length - 1) return stages[i + 1];
    return null;
  };

  const getPreviousStage = (currentStatus: string) => {
    const stages = allStages();
    const i = stages.indexOf(currentStatus);
    if (i > 0) return stages[i - 1];
    return null;
  };

  const getStageLabel = (stage: string) => {
    const labels: Record<string, string> = {
      'awaiting_collection': 'Awaiting Collection',
      'in_transit': 'Collected',
      'pending_intake': 'Delivered',
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
  const previousStage = getPreviousStage(bike.status);

  const formatCurrency = (amount: number | null) => {
    return amount ? `£${amount.toFixed(2)}` : '-';
  };

  const getSourceBadge = (source: string) => {
    const label = source === 'owned' ? 'Owned by us' : source === 'investor' ? 'Investor bike' : 'Customer consignment';
    const variant: 'default' | 'outline' | 'secondary' = source === 'owned' ? 'default' : source === 'investor' ? 'secondary' : 'outline';
    return <Badge variant={variant}>{label}</Badge>;
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
          {previousStage && (
            <Button
              variant="outline"
              onClick={() => setDialogDirection('back')}
              className="w-full sm:w-auto"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Move back to {getStageLabel(previousStage)}
            </Button>
          )}
          {nextStage && (
            <Button onClick={() => setDialogDirection('forward')} className="w-full sm:w-auto">
              <ArrowRight className="h-4 w-4 mr-2" />
              Move to {getStageLabel(nextStage)}
            </Button>
          )}
        </div>
      </div>

      {/* Status Progress */}
      <StatusProgressBar currentStatus={bike.status} bikeId={bike.id} />

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
          {canSeePricing && (
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

                <div className="mt-4 grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Collection Cost</label>
                    <p className="text-base">{formatCurrency(bike.collection_cost)}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Delivery Cost</label>
                    <p className="text-base">{formatCurrency(bike.delivery_cost)}</p>
                  </div>
                </div>

                {(() => {
                  const revenue = bike.sale_price ?? bike.asking_price;
                  const totalCost = Number(bike.purchase_price ?? 0) + Number(bike.collection_cost ?? 0) + Number(bike.delivery_cost ?? 0);
                  const hasBoth = revenue != null && bike.purchase_price != null && totalCost > 0;
                  const profit = hasBoth ? Number(revenue) - totalCost : null;
                  const margin = hasBoth && Number(revenue) > 0 ? (profit! / Number(revenue)) * 100 : null;
                  const markup = hasBoth ? (profit! / totalCost) * 100 : null;
                  const roi = hasBoth ? (profit! / totalCost) * 100 : null;
                  const basisLabel = bike.sale_price != null ? 'Based on sale price' : (bike.asking_price != null ? 'Based on asking price' : null);
                  const pct = (v: number | null) => v == null ? '-' : `${v.toFixed(1)}%`;
                  const isMargin = bike.finance_scheme === 'margin_scheme';
                  const vatOnMargin = isMargin && hasBoth ? Math.max(0, profit!) * 20 / 120 : null;
                  return (
                    <div className="mt-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <label className="text-sm font-medium text-muted-foreground">Profit</label>
                          <p className={`text-lg font-semibold ${profit != null && profit < 0 ? 'text-destructive' : ''}`}>
                            {profit == null ? '-' : formatCurrency(profit)}
                          </p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-muted-foreground">Margin</label>
                          <p className="text-lg font-semibold">{pct(margin)}</p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-muted-foreground">Markup</label>
                          <p className="text-lg font-semibold">{pct(markup)}</p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-muted-foreground">ROI</label>
                          <p className="text-lg font-semibold">{pct(roi)}</p>
                        </div>
                      </div>
                      {basisLabel && (
                        <p className="text-xs text-muted-foreground mt-2">{basisLabel} · includes collection & delivery, excludes parts/jobs costs</p>
                      )}
                      {isMargin && (
                        <div className="mt-4 p-3 rounded-md border bg-muted/30">
                          <label className="text-sm font-medium text-muted-foreground">VAT (Margin Scheme)</label>
                          <p className="text-lg font-semibold">{vatOnMargin == null ? '-' : formatCurrency(vatOnMargin)}</p>
                          <p className="text-xs text-muted-foreground">20% VAT on gross margin (1/6 of profit)</p>
                        </div>
                      )}
                    </div>
                  );
                })()}

                <div className="mt-4 grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">VAT Scheme</label>
                    <p className="text-base capitalize">{bike.finance_scheme?.replace('_', ' ') || '-'}</p>
                  </div>
                  {bike.purchase_date && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Purchase Date</label>
                      <p className="text-base">{new Date(bike.purchase_date).toLocaleDateString()}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {bike.source === 'investor' && !isMechanic && (
            <Card>
              <CardHeader>
                <CardTitle>Investor</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Investor ID</label>
                    <p className="text-base font-mono text-xs break-all">{bike.investor_id || '-'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Profit share</label>
                    <p className="text-base">{bike.profit_share_pct != null ? `${bike.profit_share_pct}%` : '-'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Purchase cost</label>
                    <p className="text-base">{formatCurrency(bike.purchase_cost)}</p>
                  </div>
                  {bike.sale_price && bike.purchase_cost != null && bike.profit_share_pct != null && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Estimated investor return</label>
                      <p className="text-base font-semibold">
                        {formatCurrency(Math.max(0, (bike.sale_price - bike.purchase_cost)) * (bike.profit_share_pct / 100))}
                      </p>
                      <p className="text-xs text-muted-foreground">Excludes parts/jobs costs</p>
                    </div>
                  )}
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

      {/* Advance/Revert Stage Dialog */}
      {dialogDirection && (dialogDirection === 'forward' ? nextStage : previousStage) && (
        <AdvanceStageDialog
          isOpen={true}
          onClose={() => setDialogDirection(null)}
          bike={bike}
          nextStage={(dialogDirection === 'forward' ? nextStage : previousStage) as string}
          nextStageLabel={
            dialogDirection === 'forward'
              ? getStageLabel(nextStage as string)
              : `${getStageLabel(previousStage as string)} (revert)`
          }
          onSuccess={onUpdate}
        />
      )}
    </div>
  );
}