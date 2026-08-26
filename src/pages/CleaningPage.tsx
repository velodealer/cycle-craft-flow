import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Eye, Sparkles } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import BikeDetailView from '@/components/bike/BikeDetailView';
import BikeThumbnail from '@/components/bike/BikeThumbnail';
import LocationSelect from '@/components/bike/LocationSelect';
import { ListCard, ListCardRow, ListCardActions, ListEmpty } from '@/components/ui/list-card';

interface Bike {
  id: string;
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
  const [bikes, setBikes] = useState<Bike[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBike, setSelectedBike] = useState<any>(null);

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
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Sparkles className="h-8 w-8" />
          Cleaning Queue
        </h1>
        <p className="text-muted-foreground mt-2">
          Bikes ready for cleaning and detailing
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Bikes in Cleaning ({bikes.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {bikes.length === 0 ? (
              <ListEmpty message="No bikes in cleaning queue" />
            ) : (
              bikes.map((bike) => (
                <ListCard key={bike.id}>
                  <div className="flex gap-3">
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
                      <Badge variant="secondary">Cleaning</Badge>
                    </div>
                  </div>
                  <ListCardRow label="Frame" value={bike.frame_number || 'Not recorded'} />
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground">Location</span>
                    <LocationSelect
                      bikeId={bike.id}
                      value={bike.storage_bay_id}
                      onChange={(bayId) => updateLocation(bike.id, bayId)}
                      size="sm"
                    />
                  </div>
                  <ListCardActions>
                    <Button variant="outline" className="w-full" onClick={() => handleView(bike)}>
                      <Eye className="h-4 w-4 mr-2" />
                      View & Clean
                    </Button>
                  </ListCardActions>
                </ListCard>
              ))
            )}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">Photo</TableHead>
                  <TableHead>Bike</TableHead>
                  <TableHead>Frame Number</TableHead>
                  <TableHead className="w-48">Location</TableHead>
                  <TableHead>Added to Cleaning</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bikes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No bikes in cleaning queue
                    </TableCell>
                  </TableRow>
                ) : (
                  bikes.map((bike) => (
                    <TableRow key={bike.id}>
                      <TableCell>
                        <BikeThumbnail
                          photos={bike.photos}
                          alt={`${bike.make} ${bike.model}`}
                          className="h-12 w-12"
                        />
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{bike.make} {bike.model}</div>
                          {bike.year && (
                            <div className="text-sm text-muted-foreground">{bike.year}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-sm">
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
                        {new Date(bike.created_at).toLocaleDateString()}
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
        </CardContent>
      </Card>

      <Dialog open={!!selectedBike} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Clean Bike</DialogTitle>
          </DialogHeader>
          {selectedBike && (
            <BikeDetailView
              bike={selectedBike}
              onEdit={() => {}}
              onBack={handleClose}
              onUpdate={loadCleaningBikes}
              showPhotos={false}
              showPricing={false}
              showDescriptions={false}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
