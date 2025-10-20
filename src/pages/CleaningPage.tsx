import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Eye, Sparkles } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import BikeDetailView from '@/components/bike/BikeDetailView';

interface Bike {
  id: string;
  make: string;
  model: string;
  year: number | null;
  status: string;
  frame_number: string | null;
  created_at: string;
}

export default function CleaningPage() {
  const [bikes, setBikes] = useState<Bike[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBike, setSelectedBike] = useState<any>(null);
  const [showDetail, setShowDetail] = useState(false);

  const loadCleaningBikes = async () => {
    try {
      const { data, error } = await supabase
        .from('bikes')
        .select('*')
        .eq('status', 'cleaning')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBikes(data || []);
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
      setShowDetail(true);
    } catch (error: any) {
      toast({
        title: 'Error loading bike details',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleBackToList = () => {
    setShowDetail(false);
    setSelectedBike(null);
    loadCleaningBikes();
  };

  const handleUpdate = () => {
    loadCleaningBikes();
  };

  if (showDetail && selectedBike) {
    return (
      <BikeDetailView
        bike={selectedBike}
        onEdit={() => {}}
        onBack={handleBackToList}
        onUpdate={handleUpdate}
        showPhotos={false}
        showPricing={false}
        showDescriptions={false}
      />
    );
  }

  if (loading) {
    return <div className="flex justify-center p-8">Loading bikes...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Sparkles className="h-8 w-8" />
            Cleaning Queue
          </h1>
          <p className="text-muted-foreground mt-2">
            Bikes ready for cleaning and detailing
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Bikes in Cleaning ({bikes.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bike</TableHead>
                  <TableHead>Frame Number</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Added to Cleaning</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bikes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      No bikes in cleaning queue
                    </TableCell>
                  </TableRow>
                ) : (
                  bikes.map((bike) => (
                    <TableRow key={bike.id}>
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
                        <Badge variant="secondary">
                          Cleaning
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(bike.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleView(bike)}
                        >
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
    </div>
  );
}
