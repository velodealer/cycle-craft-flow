import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ArrowRight, ArrowLeft, Edit, ChevronLeft, Wrench, Copy, Printer } from 'lucide-react';
import StatusProgressBar from './StatusProgressBar';
import BreakBikeDialog from './BreakBikeDialog';
import AdvanceStageDialog from './AdvanceStageDialog';
import CleaningTask from './CleaningTask';
import InspectionTask from './InspectionTask';
import BikeLabel from './BikeLabel';

import { CollectionStatus } from './CollectionStatus';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import BikeCostsSection from './BikeCostsSection';
import BikeSpecificationSection from './BikeSpecificationSection';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { copyListing, PLATFORMS, type ListingPlatform } from '@/lib/listingTemplate';
import { toast } from '@/hooks/use-toast';


interface BikeDetailViewProps {
  bike: any;
  onEdit: () => void;
  onBack: () => void;
  onUpdate: () => void;
  showPhotos?: boolean;
  showPricing?: boolean;
  showDescriptions?: boolean;
  inspectionMode?: boolean;
}

export default function BikeDetailView({ 
  bike, 
  onEdit, 
  onBack, 
  onUpdate,
  showPhotos = true,
  showPricing = true,
  showDescriptions = true,
  inspectionMode = false
}: BikeDetailViewProps) {
  const [dialogDirection, setDialogDirection] = useState<'forward' | 'back' | null>(null);
  const [showBreak, setShowBreak] = useState(false);
  const [showLabel, setShowLabel] = useState(false);
  const { profile } = useAuth();
  const isMechanic = profile?.role === 'mechanic';
  const canSeePricing = showPricing && !isMechanic;
  const [partsCost, setPartsCost] = useState(0);
  const [jobsCost, setJobsCost] = useState(0);
  const [strippedInventoryValue, setStrippedInventoryValue] = useState(0);
  const [bikeComponents, setBikeComponents] = useState<any[]>([]);

  const refreshCosts = async () => {
    if (!bike?.id) return;
    const [{ data: jobs }, { data: parts }, { data: stripped }] = await Promise.all([
      supabase.from('jobs').select('actual_cost, estimated_cost').eq('bike_id', bike.id),
      supabase.from('parts').select('cost_price, quantity').eq('bike_id', bike.id),
      supabase.from('parts').select('cost_price, quantity').eq('stripped_from_bike_id', bike.id).eq('stock_status', 'in_stock'),
    ]);

    setJobsCost((jobs || []).reduce((s: number, j: any) => s + Number(j.actual_cost ?? j.estimated_cost ?? 0), 0));
    setPartsCost((parts || []).reduce((s: number, p: any) => s + Number(p.cost_price ?? 0) * Number(p.quantity ?? 1), 0));
    setStrippedInventoryValue((stripped || []).reduce((s: number, p: any) => s + Math.max(0, Number(p.cost_price ?? 0)) * Number(p.quantity ?? 1), 0));
  };

  useEffect(() => {
    if (!canSeePricing || !bike?.id) return;
    refreshCosts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canSeePricing, bike?.id]);

  useEffect(() => {
    if (!bike?.id) return;
    (async () => {
      const { data } = await supabase
        .from('bike_components')
        .select('*, components(name, brand, model, component_categories(name))')
        .eq('bike_id', bike.id);
      const flat = (data || []).map((row: any) => ({
        brand: row.components?.brand,
        model: row.components?.model,
        name: row.components?.name,
        category: row.components?.component_categories?.name,
      }));
      setBikeComponents(flat);
    })();
  }, [bike?.id]);

  const handleCopyListing = async (platform: ListingPlatform) => {
    const res = await copyListing(platform, bike, bikeComponents);
    if (res.ok) {
      toast({ title: `Copied ${platform} listing`, description: res.format === 'html' ? 'Rich HTML on clipboard' : 'Plain text on clipboard' });
    } else {
      toast({ title: 'Copy failed', description: res.reason, variant: 'destructive' });
    }
  };


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
      'sold': 'Sold',
      'split_for_parts': 'Split for parts'
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
        {!inspectionMode && (
          <div className="flex flex-col gap-2 sm:flex-row sm:gap-2">
            <Button variant="outline" onClick={onEdit} className="w-full sm:w-auto">
              <Edit className="h-4 w-4 mr-2" />
              Edit Bike
            </Button>
            <Button variant="outline" onClick={() => setShowLabel(true)} className="w-full sm:w-auto">
              <Printer className="h-4 w-4 mr-2" />
              Print label
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full sm:w-auto">
                  <Copy className="h-4 w-4 mr-2" />
                  Copy listing
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {PLATFORMS.map((p) => (
                  <DropdownMenuItem key={p.value} onClick={() => handleCopyListing(p.value)}>
                    {p.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            {!isMechanic && bike.status !== 'sold' && bike.status !== 'split_for_parts' && (
              <Button variant="outline" onClick={() => setShowBreak(true)} className="w-full sm:w-auto">
                <Wrench className="h-4 w-4 mr-2" />
                Break bike
              </Button>
            )}
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
        )}
      </div>

      {!inspectionMode && (
        <>
          {/* Status Progress */}
          <StatusProgressBar currentStatus={bike.status} bikeId={bike.id} />

          <Separator />
        </>
      )}

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

          {/* Full bike specification */}
          {!inspectionMode && <BikeSpecificationSection bike={bike} onUpdate={onUpdate} />}

          {/* Parts & Labour */}
          {canSeePricing && !inspectionMode && (
            <BikeCostsSection bikeId={bike.id} onChange={refreshCosts} />
          )}

          {/* Pricing Information */}
          {canSeePricing && !inspectionMode && (
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

                {(() => {
                  const isSold = bike.status === 'sold';
                  const isSplit = bike.status === 'split_for_parts';
                  const revenue = Number((isSold ? bike.sale_price : bike.asking_price) || 0);
                  const acquisition = Number(bike.purchase_price ?? bike.purchase_cost ?? 0);
                  const collectionCost = Number(bike.collection_cost ?? 0);
                  const deliveryCost = Number(bike.delivery_cost ?? 0);
                  const prep = collectionCost + deliveryCost + partsCost + jobsCost;
                  const totalCost = acquisition + prep;
                  const gross = revenue - totalCost;
                  const isMargin = bike.finance_scheme === 'margin_scheme';
                  const vat = isMargin ? Math.max(0, revenue - acquisition) * 20 / 120 : 0;
                  const net = gross - vat;
                  const margin = revenue > 0 ? (net / revenue) * 100 : null;
                  const markupRoi = totalCost > 0 ? (net / totalCost) * 100 : null;
                  const pct = (v: number | null) => v == null ? '-' : `${v.toFixed(1)}%`;
                  const siv = totalCost;
                  const headroom = revenue - siv;
                  const investorShare = bike.source === 'investor' && bike.profit_share_pct != null
                    ? Math.max(0, net) * (Number(bike.profit_share_pct) / 100)
                    : null;

                  const Row = ({ label, value, negative, bold, muted, sub }: { label: string; value: string; negative?: boolean; bold?: boolean; muted?: boolean; sub?: string }) => (
                    <div className="flex justify-between items-baseline py-1.5 border-b last:border-b-0 text-sm">
                      <span className={muted ? 'text-muted-foreground' : ''}>{label}{sub && <span className="block text-xs text-muted-foreground">{sub}</span>}</span>
                      <span className={`${bold ? 'font-semibold text-base' : ''} ${negative ? 'text-destructive' : ''}`}>{value}</span>
                    </div>
                  );

                  if (isSplit) {
                    const residual = acquisition - strippedInventoryValue;
                    return (
                      <div className="mt-6">
                        <h4 className="text-sm font-semibold mb-3">Stripped for parts</h4>
                        <div className="space-y-0">
                          <Row label="Acquisition cost" value={formatCurrency(acquisition)} muted />
                          <Row label="Value moved to inventory" value={formatCurrency(strippedInventoryValue)} muted />
                          <Row label="Residual (unrecovered)" value={formatCurrency(residual)} bold negative={residual > 0} />
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div className="mt-6">
                      <h4 className="text-sm font-semibold mb-2">Cost & profit breakdown</h4>
                      <p className="text-xs text-muted-foreground mb-3">{isSold ? 'Realised — based on sale price' : 'Estimated — based on listed asking price'}</p>
                      <div className="space-y-0">
                        <Row label={isSold ? 'Sale price' : 'Asking price'} value={formatCurrency(revenue)} bold />
                        <Row label="Acquisition cost" value={`− ${formatCurrency(acquisition)}`} muted />
                        <Row label="Collection cost" value={`− ${formatCurrency(collectionCost)}`} muted />
                        <Row label="Delivery cost" value={`− ${formatCurrency(deliveryCost)}`} muted />
                        <Row label="Parts" value={`− ${formatCurrency(partsCost)}`} muted />
                        <Row label="Labour / jobs" value={`− ${formatCurrency(jobsCost)}`} muted />
                        <Row label="Total costs" value={formatCurrency(totalCost)} bold />
                        <Row label="Gross profit" value={formatCurrency(gross)} bold negative={gross < 0} />
                        {isMargin && (
                          <Row label="VAT (margin scheme)" value={`− ${formatCurrency(vat)}`} muted />
                        )}
                        <Row label="Net profit" value={formatCurrency(net)} bold negative={net < 0} />
                        {investorShare != null && (
                          <Row label={`Investor share (${bike.profit_share_pct}%)`} value={formatCurrency(investorShare)} bold />
                        )}
                      </div>

                      <div className="mt-4 p-3 rounded-md border bg-muted/30 space-y-1">
                        <div className="flex justify-between items-baseline">
                          <div className="text-sm font-semibold">Stand-In Value (break-even price)</div>
                          <div className="text-lg font-semibold">{formatCurrency(siv)}</div>
                        </div>
                        {revenue > 0 && (
                          <div className="flex justify-between items-baseline text-sm pt-2 border-t">
                            <span className="text-muted-foreground">Headroom vs SIV ({isSold ? 'sale' : 'asking'})</span>
                            <span className={`font-medium ${headroom < 0 ? 'text-destructive' : ''}`}>{headroom >= 0 ? '+' : ''}{formatCurrency(headroom)}</span>
                          </div>
                        )}
                      </div>

                      <div className="mt-4 grid grid-cols-3 gap-4">
                        <div>
                          <label className="text-xs font-medium text-muted-foreground">Margin</label>
                          <p className="text-base font-semibold">{pct(margin)}</p>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-muted-foreground">Markup</label>
                          <p className="text-base font-semibold">{pct(markupRoi)}</p>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-muted-foreground">ROI</label>
                          <p className="text-base font-semibold">{pct(markupRoi)}</p>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          )}

          {bike.source === 'investor' && !isMechanic && !inspectionMode && (
            <Card>
              <CardHeader>
                <CardTitle>Investor</CardTitle>
              </CardHeader>
              <CardContent>
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
                    <label className="text-sm font-medium text-muted-foreground">Purchase cost (investor)</label>
                    <p className="text-base">{formatCurrency(bike.purchase_cost)}</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-3">See the Cost & profit breakdown above for the investor's calculated return.</p>
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
          {!inspectionMode && <CollectionStatus bikeId={bike.id} onUpdate={onUpdate} />}
          
          {/* Show cleaning task if bike is in cleaning status */}
          {bike.status === 'cleaning' && (
            <CleaningTask bike={bike} onUpdate={onUpdate} />
          )}

          {/* Inspection record */}
          <InspectionTask bike={bike} onUpdate={onUpdate} />

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

      <BreakBikeDialog open={showBreak} onOpenChange={setShowBreak} bike={bike} onDone={onUpdate} />
    </div>
  );
}