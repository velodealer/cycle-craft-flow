import { Checkbox } from '@/components/ui/checkbox';
import PrintLabelsButton from '@/components/bike/PrintLabelsButton';
import { useLabelSelection } from '@/hooks/useLabelSelection';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader, Panel, FieldLabel, EmptyState } from '@/components/velo/PageShell';
import { StageFlap } from '@/components/velo/StageFlap';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Eye, Sparkles } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import CleaningTask from '@/components/bike/CleaningTask';
import BikeThumbnail from '@/components/bike/BikeThumbnail';
import LocationSelect from '@/components/bike/LocationSelect';
import { ListCard, ListCardRow, ListCardActions } from '@/components/ui/list-card';
import { useNavigate } from 'react-router-dom';

interface Bike {
  id: string;
  reference: string | null;
  make: string;
  model: string;
  year: number | null;
  status: string;
  frame_number: string | null;
  created_at: string;
  photos: string[] | null;
  storage_bay_id: string | null;
}


export default function CleaningPage() {
  const navigate = useNavigate();
  const [bikes, setBikes] = useState<Bike[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBike, setSelectedBike] = useState<any>(null);
  const labelSel = useLabelSelection(bikes.map((b) => b.id));

  const loadCleaningBikes = async () => {
    try {
      const { data, error } = await supabase
        .from('bikes')
        .select('*')
        .eq('status', 'cleaning')
        .order('created_at', { ascending: false });

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
    loadCleaningBikes();
  }, []);

  const handleView = async (bike: Bike) => {
    try {
      const { data, error } = await supabase
        .from('bikes')
        .select('*')
        .eq('id', bike.id)
        .single();

      if (error) throw error;
      setSelectedBike(data);
    } catch (error: any) {
      toast({
        title: 'Error loading bike details',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleClose = () => {
    setSelectedBike(null);
    loadCleaningBikes();
  };

  const updateLocation = (bikeId: string, bayId: string | null) =>
    setBikes((prev) => prev.map((b) => (b.id === bikeId ? { ...b, storage_bay_id: bayId } : b)));

  if (loading) {
    return <div className="flex justify-center p-8">Loading bikes...</div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cleaning"
        density="bench"
        description="Bikes waiting to be cleaned and detailed before inspection."
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

      <Panel title={`In cleaning (${bikes.length})`} bodyClassName="p-0 md:p-0">
        <div className="p-4 md:p-0">
          {/* Mobile cards */}
          <div className="space-y-3 lg:hidden">
            {bikes.length === 0 ? (
              <EmptyState
                fact="Nothing in the cleaning queue."
                fix="Bikes land here once intake is finished."
              />
            ) : (
              bikes.map((bike) => (
                <ListCard key={bike.id}>
                  <div className="flex gap-3">
                    <Checkbox
                      className="mt-1"
                      checked={labelSel.selected.has(bike.id)}
                      onCheckedChange={() => labelSel.toggle(bike.id)}
                    />
                    <button type="button" className="shrink-0" onClick={() => navigate(`/bikes/${bike.id}`)}><BikeThumbnail photos={bike.photos} alt={`${bike.make} ${bike.model}`} className="h-20 w-20" /></button>
                    <div className="min-w-0 flex-1 space-y-2">
                      <button type="button" className="block text-left font-semibold leading-tight break-words hover:underline" onClick={() => navigate(`/bikes/${bike.id}`)}>
                        {bike.make} {bike.model}
                        {bike.year ? <span className="text-muted-foreground"> · {bike.year}</span> : null}
                      </button>
                      <StageFlap stage="cleaning" />
                    </div>
                  </div>
                  <ListCardRow label="Frame" value={bike.frame_number || 'Not recorded'} />
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
                    <Button variant="outline" size="bench" className="w-full" onClick={() => handleView(bike)}>
                      <Eye className="h-4 w-4 mr-2" />
                      View & Clean
                    </Button>
                  </ListCardActions>
                </ListCard>
              ))
            )}
          </div>

          {/* Desktop table */}
          <div className="hidden lg:block overflow-hidden">
            <Table className="table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead className="w-[35%]">Bike</TableHead>
                  <TableHead className="w-[18%]">Frame</TableHead>
                  <TableHead className="w-[22%]">Location</TableHead>
                  <TableHead className="w-[25%]"><span className="sr-only">Actions</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bikes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="p-0">
                      <EmptyState
                        fact="Nothing in the cleaning queue."
                        fix="Bikes land here once intake is finished."
                      />
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
                          <button type="button" className="shrink-0" onClick={() => navigate(`/bikes/${bike.id}`)}><BikeThumbnail photos={bike.photos} alt={`${bike.make} ${bike.model}`} className="h-12 w-12" /></button>
                          <div className="min-w-0">
                          <button type="button" className="block text-left font-medium break-words hover:underline" onClick={() => navigate(`/bikes/${bike.id}`)}>{bike.make} {bike.model}</button>
                          {bike.year && (
                            <div className="text-sm text-muted-foreground">{bike.year}</div>
                          )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="id-text">{bike.frame_number || 'Not recorded'}</span>
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
                        <Button variant="outline" size="sm" onClick={() => handleView(bike)}>
                          <Eye className="h-4 w-4 mr-2" />
                          View & Clean
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

      <Dialog open={!!selectedBike} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">Clean bike</DialogTitle>
          </DialogHeader>
          {selectedBike && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <BikeThumbnail
                  photos={selectedBike.photos}
                  alt={`${selectedBike.make} ${selectedBike.model}`}
                  className="h-16 w-16"
                />
                <div className="min-w-0">
                  <div className="font-semibold leading-tight break-words">
                    {selectedBike.make} {selectedBike.model}
                    {selectedBike.year ? (
                      <span className="text-muted-foreground"> · {selectedBike.year}</span>
                    ) : null}
                  </div>
                  <div className="id-text text-sm text-muted-foreground">
                    {selectedBike.frame_number || 'Frame not recorded'}
                  </div>
                </div>
              </div>
              <CleaningTask bike={selectedBike} onUpdate={loadCleaningBikes} />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
