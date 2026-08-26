import { Checkbox } from '@/components/ui/checkbox';
import PrintLabelsButton from '@/components/bike/PrintLabelsButton';
import { useLabelSelection } from '@/hooks/useLabelSelection';
import { useEffect, useState } from 'react';
import IntakeForm from '@/components/intake/IntakeForm';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import BikeThumbnail from '@/components/bike/BikeThumbnail';
import LocationSelect from '@/components/bike/LocationSelect';

interface PendingBike {
  id: string;
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
      .select('id, make, model, frame_number, source, status, intake_date, photos, storage_bay_id')
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
      <div>
        <h1 className="text-3xl font-bold">Bike Intake</h1>
        <p className="text-muted-foreground">
          Bikes currently awaiting intake
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Bikes Awaiting Intake</CardTitle>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <Checkbox checked={labelSel.allSelected} onCheckedChange={labelSel.toggleAll} />
              Select all
            </label>
            <PrintLabelsButton bikes={pending as any} selectedIds={labelSel.selected} />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : pending.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No bikes are currently awaiting intake.
            </p>
          ) : (
            <div className="space-y-3">
              {pending.map((bike) => (
                <div key={bike.id} className="rounded-lg border p-4 space-y-3">
                  <div className="flex gap-3">
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
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="font-semibold leading-tight break-words">
                        {bike.make} {bike.model}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={bike.status === 'pending_intake' ? 'secondary' : 'default'}>
                          {bike.status === 'pending_intake' ? 'Delivered' : 'Intake'}
                        </Badge>
                        <Badge variant="outline">
                          {bike.source === 'owned' ? 'Owned' : 'Consignment'}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {bike.frame_number && <>Frame: {bike.frame_number} • </>}
                        Arrived {new Date(bike.intake_date).toLocaleDateString()}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <div className="flex-1 space-y-1">
                      <span className="text-xs text-muted-foreground">Location</span>
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
                      onClick={() => setProcessBikeId(bike.id)}
                      className="w-full sm:w-auto sm:self-end"
                    >
                      Process intake
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

          )}
        </CardContent>
      </Card>

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
