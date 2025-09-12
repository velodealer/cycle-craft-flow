import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, Plus, Edit, Eye } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface Bike {
  id: string;
  make: string;
  model: string;
  year: number | null;
  status: string;
  source: string;
  asking_price: number | null;
  sale_price: number | null;
  created_at: string;
}

interface BikeListProps {
  onEdit: (bike: Bike) => void;
  onAdd: () => void;
}

export default function BikeList({ onEdit, onAdd }: BikeListProps) {
  const [bikes, setBikes] = useState<Bike[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');

  const loadBikes = async () => {
    try {
      let query = supabase
        .from('bikes')
        .select('id, make, model, year, status, source, asking_price, sale_price, created_at')
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter as any);
      }
      if (sourceFilter !== 'all') {
        query = query.eq('source', sourceFilter as any);
      }

      const { data, error } = await query;

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
    loadBikes();
  }, [statusFilter, sourceFilter]);

  const filteredBikes = bikes.filter(bike =>
    searchTerm === '' ||
    bike.make.toLowerCase().includes(searchTerm.toLowerCase()) ||
    bike.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
    bike.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      'intake': 'outline',
      'cleaning': 'secondary',
      'inspection': 'secondary',
      'pending_approval': 'destructive',
      'repair': 'destructive',
      'ready': 'default',
      'listed': 'default',
      'sold': 'secondary'
    };

    const labels: Record<string, string> = {
      'pending_approval': 'Awaiting Approval',
      'ready': 'Ready for Sale'
    };

    return (
      <Badge variant={variants[status] || 'outline'}>
        {labels[status] || status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const getSourceBadge = (source: string) => {
    return (
      <Badge variant={source === 'owned' ? 'default' : 'outline'}>
        {source === 'owned' ? 'Owned' : 'Consignment'}
      </Badge>
    );
  };

  if (loading) {
    return <div className="flex justify-center p-8">Loading bikes...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Bikes ({filteredBikes.length})</CardTitle>
          <Button onClick={onAdd}>
            <Plus className="h-4 w-4 mr-2" />
            Add Bike
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search bikes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full md:w-48">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="intake">Intake</SelectItem>
              <SelectItem value="cleaning">Cleaning</SelectItem>
              <SelectItem value="inspection">Inspection</SelectItem>
              <SelectItem value="pending_approval">Awaiting Approval</SelectItem>
              <SelectItem value="repair">Repair</SelectItem>
              <SelectItem value="ready">Ready for Sale</SelectItem>
              <SelectItem value="listed">Listed</SelectItem>
              <SelectItem value="sold">Sold</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="w-full md:w-48">
              <SelectValue placeholder="Filter by source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sources</SelectItem>
              <SelectItem value="owned">Owned</SelectItem>
              <SelectItem value="customer_consignment">Consignment</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bike</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Asking Price</TableHead>
                <TableHead>Sale Price</TableHead>
                <TableHead>Added</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredBikes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No bikes found
                  </TableCell>
                </TableRow>
              ) : (
                filteredBikes.map((bike) => (
                  <TableRow key={bike.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{bike.make} {bike.model}</div>
                        {bike.year && (
                          <div className="text-sm text-muted-foreground">{bike.year}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(bike.status)}</TableCell>
                    <TableCell>{getSourceBadge(bike.source)}</TableCell>
                    <TableCell>
                      {bike.asking_price ? `£${bike.asking_price.toFixed(2)}` : '-'}
                    </TableCell>
                    <TableCell>
                      {bike.sale_price ? `£${bike.sale_price.toFixed(2)}` : '-'}
                    </TableCell>
                    <TableCell>
                      {new Date(bike.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onEdit(bike)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}