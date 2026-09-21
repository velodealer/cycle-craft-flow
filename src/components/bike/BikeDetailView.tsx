import { useEffect, useState } from 'react';
import { bikeRef } from '@/lib/bikeReference';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ArrowRight, ArrowLeft, Edit, ChevronLeft, Wrench, Copy, Printer, Loader2, Trash2 } from 'lucide-react';
import StatusProgressBar from './StatusProgressBar';
import { StageFlap } from '@/components/velo/StageFlap';
import { MarginTriple } from '@/components/velo/MarginTriple';
import BreakBikeDialog from './BreakBikeDialog';
import DeleteBikeDialog from './DeleteBikeDialog';
import AdvanceStageDialog from './AdvanceStageDialog';
import RecordSaleDialog from './RecordSaleDialog';
import CleaningTask from './CleaningTask';
import InspectionTask from './InspectionTask';
import IntakeTask from './IntakeTask';
import BikePhotoGallery from './BikePhotoGallery';
import StageHistory from './StageHistory';
import AdminStatusSelect from './AdminStatusSelect';
import ShopifyListingCard from './ShopifyListingCard';
import EbayListingCard from './EbayListingCard';



import { downloadBikeLabelsPdf } from '@/lib/bikeLabelPdf';


import { CollectionStatus } from './CollectionStatus';
import { useAuth } from '@/hooks/useAuth';
import { useVatRegistered } from '@/hooks/useVatRegistered';
import { supabase } from '@/integrations/supabase/client';
import BikeCostsSection from './BikeCostsSection';
import BikeCostBreakdown from './BikeCostBreakdown';
import BikeSpecificationSection from './BikeSpecificationSection';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { copyListing, PLATFORMS, type ListingPlatform } from '@/lib/listingTemplate';
import { toast } from '@/hooks/use-toast';
import { stockInDocNumber, stockOutDocNumber } from '@/lib/quickbooks';



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
  const [showDelete, setShowDelete] = useState(false);
  const [labelBusy, setLabelBusy] = useState(false);
  const { profile } = useAuth();
  const { vatRegistered } = useVatRegistered();
  const isMechanic = profile?.role === 'mechanic';
  const isAdmin = profile?.role === 'admin';
  const canSeePricing = showPricing && !isMechanic;
  const [partsCost, setPartsCost] = useState(0);
  const [jobsCost, setJobsCost] = useState(0);
  const [strippedInventoryValue, setStrippedInventoryValue] = useState(0);
  const [bikeComponents, setBikeComponents] = useState<any[]>([]);
  const [saleDraft, setSaleDraft] = useState<any | null>(null);
  const [forceSaleDialog, setForceSaleDialog] = useState(false);

  useEffect(() => {
    if (!bike?.id || inspectionMode) return;
    let active = true;
    supabase
      .from('sale_drafts')
      .select('payload, updated_at')
      .eq('bike_id', bike.id)
      .maybeSingle()
      .then(({ data }) => {
        if (active) setSaleDraft(data ?? null);
      });
    return () => { active = false; };
  }, [bike?.id, inspectionMode, bike?.status]);

  const discardSaleDraft = async () => {
    const { error } = await supabase.from('sale_drafts').delete().eq('bike_id', bike.id);
    if (error) {
      toast({ title: 'Could not discard the draft', description: error.message, variant: 'destructive' });
      return;
    }
    setSaleDraft(null);
    toast({ title: 'Sale draft discarded' });
  };

  const handleDownloadLabel = async () => {
    setLabelBusy(true);
    try {
      await downloadBikeLabelsPdf(
        [
          {
            id: bike.id,
            reference: bike.reference,
            make: bike.make,
            model: bike.model,
            size: bike.size,
            colour: bike.colour,
            frame_number: bike.frame_number,
          },
        ],
        window.location.origin,
      );
    } catch (e) {
      console.error(e);
      toast({ title: 'Could not generate the label PDF', variant: 'destructive' });
    } finally {
      setLabelBusy(false);
    }
  };

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
      <div className="space-y-4">
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:gap-4">
          <Button variant="ghost" size="sm" onClick={onBack} className="w-fit">
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back to List
          </Button>
          <div className="min-w-0 space-y-1">
            <h1 className="break-words font-display text-[28px] font-bold leading-tight">
              {bike.year ? `${bike.year} ` : ''}{bike.make} {bike.model}
            </h1>
            <div className="flex flex-wrap items-center gap-2">
              <span className="id-text">{bikeRef(bike as any)}</span>
              <StageFlap stage={bike.status} />
            </div>
          </div>
        </div>
        {!inspectionMode && (
          <div className="flex flex-wrap gap-2 border-t border-border pt-4">
            <Button variant="outline" onClick={onEdit} className="w-full sm:w-auto">
              <Edit className="h-4 w-4 mr-2" />
              Edit Bike
            </Button>
            <Button
              variant="outline"
              onClick={handleDownloadLabel}
              disabled={labelBusy}
              className="w-full sm:w-auto"
            >
              {labelBusy ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Printer className="h-4 w-4 mr-2" />
              )}
              Label (4x6 PDF)
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
            {isAdmin && (
              <Button
                variant="destructive"
                onClick={() => setShowDelete(true)}
                className="min-w-0"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete bike
              </Button>
            )}
            {previousStage && (
              <Button
                variant="outline"
                onClick={() => setDialogDirection('back')}
                className="min-w-0"
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
          {isAdmin && <AdminStatusSelect bike={bike} onUpdate={onUpdate} />}

          {/* Status Progress */}
          <StatusProgressBar currentStatus={bike.status} bikeId={bike.id} />

          <Separator />
        </>
      )}


      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Photos */}
          {showPhotos && (
            <BikePhotoGallery photos={bike.photos} alt={`${bike.make} ${bike.model}`} />
          )}


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
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  {getSourceBadge(bike.source)}
                  {bike.acquired_via === 'part_exchange' && (
                    <Badge variant="outline">Taken in part exchange</Badge>
                  )}
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

          {/* Pricing & finance lives in the rail (see below) */}

          {!isMechanic && !inspectionMode && <ShopifyListingCard bikeId={bike.id} />}

          {!isMechanic && !inspectionMode && <EbayListingCard bikeId={bike.id} />}


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

        {/* Rail: money, logistics, history */}
        <div className="space-y-6">
          {/* Pricing & finance */}
          {canSeePricing && !inspectionMode && (
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Pricing &amp; finance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap items-baseline gap-2">
                  <MarginTriple cost={bike.purchase_price} asking={bike.asking_price} className="text-lg" />
                </div>
                <div className="mt-4 grid grid-cols-3 gap-4">
                  <div>
                    <p className="label-text">Purchase</p>
                    <p className="text-base font-medium tabular">{formatCurrency(bike.purchase_price)}</p>
                  </div>
                  <div>
                    <p className="label-text">Asking</p>
                    <p className="text-base font-medium tabular">{formatCurrency(bike.asking_price)}</p>
                  </div>
                  <div>
                    <p className="label-text">Sale</p>
                    <p className="text-base font-medium tabular">{formatCurrency(bike.sale_price)}</p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-4">
                  {vatRegistered && (
                  <div>
                    <p className="label-text">VAT scheme</p>
                    <p className="text-base capitalize">{bike.finance_scheme?.replace('_', ' ') || '-'}</p>
                  </div>
                  )}
                  {bike.purchase_date && (
                    <div>
                      <p className="label-text">Purchase date</p>
                      <p className="text-base tabular">{new Date(bike.purchase_date).toLocaleDateString('en-GB')}</p>
                    </div>
                  )}
                </div>

                <div className="mt-4 rounded-md border p-3">
                  <div className="label-text">QuickBooks postings</div>
                  <div className="mt-2 space-y-1 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-muted-foreground">
                        Stock in {stockInDocNumber(bike.reference) ? `· ${stockInDocNumber(bike.reference)}` : ''}
                      </span>
                      <Badge
                        variant={
                          bike.purchase_sync_status === 'synced'
                            ? 'success'
                            : bike.purchase_sync_status === 'failed'
                              ? 'destructive'
                              : 'secondary'
                        }
                      >
                        {bike.purchase_sync_status === 'synced'
                          ? 'Posted'
                          : bike.purchase_sync_status === 'failed'
                            ? 'Failed'
                            : bike.purchase_sync_status === 'skipped'
                              ? 'No purchase price'
                              : 'Not posted'}
                      </Badge>
                    </div>
                    {bike.purchase_sync_error && (
                      <p className="text-xs text-destructive">{bike.purchase_sync_error}</p>
                    )}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-muted-foreground">
                        Stock out {stockOutDocNumber(bike.reference) ? `· ${stockOutDocNumber(bike.reference)}` : ''}
                      </span>
                      <Badge variant={bike.status === 'sold' ? 'success' : 'secondary'}>
                        {bike.status === 'sold' ? 'Posted on sale' : 'Pending sale'}
                      </Badge>
                    </div>
                  </div>
                </div>

                <BikeCostBreakdown
                  bike={bike}
                  partsCost={partsCost}
                  jobsCost={jobsCost}
                  strippedInventoryValue={strippedInventoryValue}
                />
              </CardContent>
            </Card>
          )}

          {/* Saved sale draft */}
          {!inspectionMode && saleDraft && bike.status !== 'sold' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Sale draft saved</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p className="text-muted-foreground">
                  Nothing has been invoiced yet. Sale price £{Number(saleDraft.payload?.salePrice || 0).toFixed(2)}
                  {saleDraft.payload?.newCustomer?.name ? ` · ${saleDraft.payload.newCustomer.name}` : ''}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => setForceSaleDialog(true)}>Continue sale</Button>
                  <Button size="sm" variant="outline" onClick={discardSaleDraft}>Discard draft</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Show collection status if bike has collection */}
          {!inspectionMode && <CollectionStatus bikeId={bike.id} onUpdate={onUpdate} />}
          {!inspectionMode && <CollectionStatus bikeId={bike.id} direction="outbound" onUpdate={onUpdate} />}

          {/* Intake */}
          {!inspectionMode && <IntakeTask bike={bike} onUpdate={onUpdate} />}

          
          {/* Show cleaning task if bike is in cleaning status */}
          {bike.status === 'cleaning' && (
            <CleaningTask bike={bike} onUpdate={onUpdate} />
          )}

          {/* Inspection record */}
          <InspectionTask bike={bike} onUpdate={onUpdate} />

          {/* Stage notes & photos history */}
          {!inspectionMode && <StageHistory bikeId={bike.id} />}



        </div>
      </div>

      {/* Record sale */}
      {(forceSaleDialog || (dialogDirection === 'forward' && nextStage === 'sold')) && (
        <RecordSaleDialog
          isOpen={true}
          onClose={() => { setDialogDirection(null); setForceSaleDialog(false); }}
          bike={bike}
          onSuccess={() => {
            supabase.from('sale_drafts').select('payload, updated_at').eq('bike_id', bike.id).maybeSingle()
              .then(({ data }) => setSaleDraft(data ?? null));
            onUpdate();
          }}
        />
      )}

      {/* Advance/Revert Stage Dialog */}
      {dialogDirection &&
        !(dialogDirection === 'forward' && nextStage === 'sold') &&
        (dialogDirection === 'forward' ? nextStage : previousStage) && (
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

      {isAdmin && (
        <DeleteBikeDialog
          bike={bike}
          open={showDelete}
          onOpenChange={setShowDelete}
          onDeleted={() => {
            onUpdate();
            onBack();
          }}
        />
      )}
    </div>
  );
}