import { Checkbox } from '@/components/ui/checkbox';
import PrintLabelsButton from '@/components/bike/PrintLabelsButton';
import { useLabelSelection } from '@/hooks/useLabelSelection';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader, Panel, FieldLabel, EmptyState } from '@/components/velo/PageShell';
import { StageFlap } from '@/components/velo/StageFlap';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ExternalLink, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import BikeThumbnail from '@/components/bike/BikeThumbnail';
import LocationSelect from '@/components/bike/LocationSelect';
import { ListCard, ListCardRow, ListCardActions, ListEmpty } from '@/components/ui/list-card';

interface Bike {
  id: string;
  reference: string | null;
  make: string;
  model: string;
  year: number | null;
  status: string;
  frame_number: string | null;
  created_at: string;
  updated_at: string;
  photos: string[] | null;
  storage_bay_id: string | null;
}


export default function InspectionPage() {
  const [bikes, setBikes] = useState<Bike[]>([]);
  const [loading, setLoading] = useState(true);
  const [startingBikeId, setStartingBikeId] = useState<string | null>(null);
  const labelSel = useLabelSelection(bikes.map((b) => b.id));

  const loadInspectionBikes = async () => {
    try {
      const { data, error } = await supabase
        .from('bikes')
        .select('*')
        .eq('status', 'inspection')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setBikes((data as any) || []);
    } catch (error: any) {
      toast({
        title: 'Error loading bikes',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInspectionBikes();
  }, []);

  const handleStart = async (bike: Bike) => {
    setStartingBikeId(bike.id);
    try {
      const { data, error } = await supabase.functions.invoke('inspectabike-create', { body: { bike_id: bike.id } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const inspectionUrl = data?.inspection?.report_url;
      if (!inspectionUrl) throw new Error('InspectABike did not return an inspection link');
      window.location.assign(inspectionUrl);
    } catch (error: any) {
      toast({
        title: 'Could not start inspection',
        description: error.message,
        variant: 'destructive',
      });
      setStartingBikeId(null);
    }
  };

  const updateLocation = (bikeId: string, bayId: string | null) =>
    setBikes((prev) => prev.map((b) => (b.id === bikeId ? { ...b, storage_bay_id: bayId } : b)));

  if (loading) {
    return <div className="flex justify-center p-8">Loading bikes...</div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inspection"
        density="bench"
        description="Bikes waiting on a mechanical inspection. Faults and grades come back from InspectABike."
        actions={
          <>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <Checkbox checked={labelSel.allSelected} onCheckedChange={labelSel.toggleAll} />
              Select all
            </label>
            <PrintLabelsButton bikes={bikes as any} selectedIds={labelSel.selected} />
          </>
        }
      />

      <Panel title={`Awaiting inspection (${bikes.length})`} bodyClassName="p-4 md:p-0">
        <div>
          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {bikes.length === 0 ? (
              <EmptyState fact="Nothing waiting for inspection." fix="Bikes arrive here once cleaning is signed off." />
            ) : (
              bikes.map((bike) => (
                <ListCard key={bike.id}>
                  <div className="flex gap-3">
                    <Checkbox
                      className="mt-1"
                      checked={labelSel.selected.has(bike.id)}
                      onCheckedChange={() => labelSel.toggle(bike.id)}
                    />
                    <BikeThumbnail
                      photos={bike.photos}
                      alt={`${bike.make} ${bike.model}`}
                      className="h-20 w-20"
                    />
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="font-semibold leading-tight break-words">
                        {bike.make} {bike.model}
                        {bike.year ? <span className="text-muted-foreground"> · {bike.year}</span> : null}
                      </div>
                      <StageFlap stage="inspection" />
                    </div>
                  </div>
                  <ListCardRow label="Frame" value={bike.frame_number || 'Not recorded'} />
                  <ListCardRow
                    label="Entered"
                    value={new Date(bike.updated_at || bike.created_at).toLocaleDateString()}
                  />
                  <div className="space-y-1">
                    <FieldLabel>Location</FieldLabel>
                    <LocationSelect
                      bikeId={bike.id}
                      value={bike.storage_bay_id}
                      onChange={(bayId) => updateLocation(bike.id, bayId)}
                      size="sm"
                    />
                  </div>
                  <ListCardActions>
                    <Button variant="outline" className="w-full" disabled={startingBikeId === bike.id} onClick={() => handleStart(bike)}>
                      {startingBikeId === bike.id ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ExternalLink className="h-4 w-4 mr-2" />}
                      Start inspection
                    </Button>
                  </ListCardActions>
                </ListCard>
              ))
            )}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block overflow-hidden">
            <Table className="table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead className="w-[36%]">Bike</TableHead>
                  <TableHead className="w-[20%]">Frame</TableHead>
                  <TableHead className="w-[25%]">Location</TableHead>
                  <TableHead className="w-[19%]"><span className="sr-only">Actions</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bikes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      No bikes awaiting inspection
                    </TableCell>
                  </TableRow>
                ) : (
                  bikes.map((bike) => (
                    <TableRow key={bike.id}>
                      <TableCell>
                        <Checkbox
                          checked={labelSel.selected.has(bike.id)}
                          onCheckedChange={() => labelSel.toggle(bike.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex min-w-0 items-center gap-3">
                          <BikeThumbnail photos={bike.photos} alt={`${bike.make} ${bike.model}`} className="h-12 w-12 shrink-0" />
                          <div className="min-w-0">
                          <div className="font-medium break-words">{bike.make} {bike.model}</div>
                          {bike.year && (
                            <div className="text-sm text-muted-foreground">{bike.year}</div>
                          )}
                          <div className="text-xs text-muted-foreground">Entered {new Date(bike.updated_at || bike.created_at).toLocaleDateString()}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="id-text">
                          {bike.frame_number || 'Not recorded'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <LocationSelect
                          bikeId={bike.id}
                          value={bike.storage_bay_id}
                          onChange={(bayId) => updateLocation(bike.id, bayId)}
                          size="sm"
                        />
                      </TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm" disabled={startingBikeId === bike.id} onClick={() => handleStart(bike)}>
                          {startingBikeId === bike.id ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ExternalLink className="h-4 w-4 mr-2" />}
                          Start inspection
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </Panel>

    </div>
  );
}
