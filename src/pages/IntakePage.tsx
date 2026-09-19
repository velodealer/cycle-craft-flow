import { Checkbox } from '@/components/ui/checkbox';
import PrintLabelsButton from '@/components/bike/PrintLabelsButton';
import { useLabelSelection } from '@/hooks/useLabelSelection';
import { useEffect, useState } from 'react';
import IntakeForm from '@/components/intake/IntakeForm';
import { Button } from '@/components/ui/button';
import { PageHeader, Panel, FieldLabel, EmptyState } from '@/components/velo/PageShell';
import { StageFlap } from '@/components/velo/StageFlap';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import BikeThumbnail from '@/components/bike/BikeThumbnail';
import LocationSelect from '@/components/bike/LocationSelect';

interface PendingBike {
  id: string;
  reference: string | null;
  make: string;
  model: string;
  frame_number: string | null;
  source: string;
  status: string;
  intake_date: string;
  photos: string[] | null;
  storage_bay_id: string | null;
}


export default function IntakePage() {
  const [processBikeId, setProcessBikeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<PendingBike[]>([]);
  const labelSel = useLabelSelection(pending.map((b) => b.id));

  const load = async () => {
    setLoading(true);
    const pendingRes = await supabase
      .from('bikes')
      .select('id, reference, make, model, frame_number, source, status, intake_date, photos, storage_bay_id')
      .in('status', ['pending_intake', 'intake'])
      .order('intake_date', { ascending: true });

    setPending((pendingRes.data || []) as PendingBike[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Intake"
        density="bench"
        description="Bikes waiting to be booked in. Process each one, then print its labels."
        actions={
          <>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <Checkbox checked={labelSel.allSelected} onCheckedChange={labelSel.toggleAll} />
              Select all
            </label>
            <PrintLabelsButton bikes={pending as any} selectedIds={labelSel.selected} />
          </>
        }
      />

      <Panel title={`Awaiting intake (${pending.length})`} bodyClassName="p-0">
        {loading ? (
          <div className="space-y-2 p-4">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : pending.length === 0 ? (
          <EmptyState
            fact="No bikes are waiting for intake."
            fix="Bikes appear here once they're delivered or converted from a submission."
          />
        ) : (
          <div>
            {pending.map((bike) => (
              <div
                key={bike.id}
                className="flex flex-col gap-3 border-b border-border p-4 last:border-b-0 md:flex-row md:items-center"
              >
                <div className="flex min-w-0 flex-1 gap-3">
                  <Checkbox
                    className="mt-1"
                    checked={labelSel.selected.has(bike.id)}
                    onCheckedChange={() => labelSel.toggle(bike.id)}
                  />
                  <BikeThumbnail
                    photos={bike.photos}
                    alt={`${bike.make} ${bike.model}`}
                    className="h-20 w-20 sm:h-16 sm:w-16"
                  />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="font-medium leading-tight break-words">
                      {bike.make} {bike.model}
                      {bike.reference ? (
                        <span className="id-text ml-2 text-muted-foreground">{bike.reference}</span>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <StageFlap stage={bike.status} />
                      <Badge variant="outline">
                        {bike.source === 'owned' ? 'Owned' : 'Consignment'}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {bike.frame_number && (
                        <>
                          Frame <span className="id-text">{bike.frame_number}</span> ·{' '}
                        </>
                      )}
                      Arrived <span className="id-text">{new Date(bike.intake_date).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2 md:w-[380px] md:flex-row md:items-end">
                  <div className="flex-1 space-y-1">
                    <FieldLabel>Location</FieldLabel>
                    <LocationSelect
                      bikeId={bike.id}
                      value={bike.storage_bay_id}
                      onChange={(bayId) =>
                        setPending((prev) =>
                          prev.map((b) => (b.id === bike.id ? { ...b, storage_bay_id: bayId } : b)),
                        )
                      }
                      size="sm"
                    />
                  </div>
                  <Button
                    size="bench"
                    onClick={() => setProcessBikeId(bike.id)}
                    className="w-full md:w-auto"
                  >
                    Process intake
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Dialog open={!!processBikeId} onOpenChange={(open) => !open && setProcessBikeId(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Process Intake</DialogTitle>
          </DialogHeader>
          {processBikeId && (
            <IntakeForm
              preselectedBikeId={processBikeId}
              onSuccess={() => {
                setProcessBikeId(null);
                load();
              }}
              onCancel={() => setProcessBikeId(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
