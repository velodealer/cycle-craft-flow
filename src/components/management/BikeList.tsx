import { Checkbox } from '@/components/ui/checkbox';
import PrintLabelsButton from '@/components/bike/PrintLabelsButton';
import { useLabelSelection } from '@/hooks/useLabelSelection';
import { bikeRef } from '@/lib/bikeReference';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, Plus, Eye } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import BikeThumbnail from '@/components/bike/BikeThumbnail';
import LocationSelect from '@/components/bike/LocationSelect';
import { ListCard, ListCardRow, ListCardActions, ListEmpty } from '@/components/ui/list-card';
import { useStorageBays } from '@/hooks/useStorageBays';

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
  photos: string[] | null;
  storage_bay_id: string | null;
  frame_number: string | null;
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
  const [locationFilter, setLocationFilter] = useState('all');
  const { bays } = useStorageBays();

  const loadBikes = async () => {
    try {
      let query = supabase
        .from('bikes')
        .select('id, make, model, year, status, source, asking_price, sale_price, created_at, photos, storage_bay_id, frame_number')
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter as any);
      }
      if (sourceFilter !== 'all') {
        query = query.eq('source', sourceFilter as any);
      }

      const { data, error } = await query;

      if (error) throw error;
      setBikes((data as Bike[]) || []);
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

  const bayName = (id: string | null) => {
    if (!id) return null;
    const bay = bays.find((b) => b.id === id);
    if (!bay) return null;
    return bay.zone ? `${bay.zone} · ${bay.name}` : bay.name;
  };

  const filteredBikes = bikes.filter((bike) => {
    const matchesSearch =
      searchTerm === '' ||
      bike.make.toLowerCase().includes(searchTerm.toLowerCase()) ||
      bike.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
      bike.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (bike as any).reference?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesLocation =
      locationFilter === 'all' ||
      (locationFilter === 'unassigned' ? !bike.storage_bay_id : bike.storage_bay_id === locationFilter);

    return matchesSearch && matchesLocation;
  });

  const labelSel = useLabelSelection(filteredBikes.map((b: any) => b.id));

  const handleLocationChange = (bikeId: string, bayId: string | null) => {
    setBikes((prev) => prev.map((b) => (b.id === bikeId ? { ...b, storage_bay_id: bayId } : b)));
  };

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
    const label = source === 'owned' ? 'Owned' : source === 'investor' ? 'Investor' : 'Consignment';
    const variant: 'default' | 'outline' | 'secondary' = source === 'owned' ? 'default' : source === 'investor' ? 'secondary' : 'outline';
    return <Badge variant={variant}>{label}</Badge>;
  };

  if (loading) {
    return <div className="flex justify-center p-8">Loading bikes...</div>;
  }

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
          <CardTitle>Bikes ({filteredBikes.length})</CardTitle>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <Checkbox checked={labelSel.allSelected} onCheckedChange={labelSel.toggleAll} />
              Select all
            </label>
            <PrintLabelsButton bikes={filteredBikes as any} selectedIds={labelSel.selected} />
          </div>
          <Button onClick={onAdd} className="w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            Add Bike
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col md:flex-row gap-3 mb-6">
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
            <SelectTrigger className="w-full md:w-44">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent className="bg-popover z-50">
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
            <SelectTrigger className="w-full md:w-40">
              <SelectValue placeholder="Filter by source" />
            </SelectTrigger>
            <SelectContent className="bg-popover z-50">
              <SelectItem value="all">All Sources</SelectItem>
              <SelectItem value="owned">Owned</SelectItem>
              <SelectItem value="customer_consignment">Consignment</SelectItem>
              <SelectItem value="investor">Investor</SelectItem>
            </SelectContent>
          </Select>
          <Select value={locationFilter} onValueChange={setLocationFilter}>
            <SelectTrigger className="w-full md:w-44">
              <SelectValue placeholder="Filter by location" />
            </SelectTrigger>
            <SelectContent className="bg-popover z-50">
              <SelectItem value="all">All Locations</SelectItem>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {bays.map((bay) => (
                <SelectItem key={bay.id} value={bay.id}>
                  {bay.zone ? `${bay.zone} · ${bay.name}` : bay.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Mobile cards */}
        <div className="space-y-3 md:hidden">
          {filteredBikes.length === 0 ? (
            <ListEmpty message="No bikes found" />
          ) : (
            filteredBikes.map((bike) => (
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
                    <div className="text-xs font-mono text-muted-foreground">{bikeRef(bike as any)}</div>
                    <div className="flex flex-wrap gap-2">
                      {getStatusBadge(bike.status)}
                      {getSourceBadge(bike.source)}
                      <Badge variant="outline">{bayName(bike.storage_bay_id) || 'Unassigned'}</Badge>
                    </div>
                  </div>
                </div>

                <ListCardRow
                  label="Asking"
                  value={bike.asking_price ? `£${bike.asking_price.toFixed(2)}` : '-'}
                />
                <ListCardRow
                  label="Sale"
                  value={bike.sale_price ? `£${bike.sale_price.toFixed(2)}` : '-'}
                />
                <ListCardRow label="Added" value={new Date(bike.created_at).toLocaleDateString()} />

                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Location</span>
                  <LocationSelect
                    bikeId={bike.id}
                    value={bike.storage_bay_id}
                    onChange={(bayId) => handleLocationChange(bike.id, bayId)}
                    size="sm"
                  />
                </div>

                <ListCardActions>
                  <Button variant="outline" className="w-full" onClick={() => onEdit(bike)}>
                    <Eye className="h-4 w-4 mr-2" />
                    View bike
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
                <TableHead className="w-10"></TableHead>
                <TableHead className="w-20">Photo</TableHead>
                <TableHead>Bike</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Source</TableHead>
                <TableHead className="w-48">Location</TableHead>
                <TableHead>Asking Price</TableHead>
                <TableHead>Sale Price</TableHead>
                <TableHead>Added</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredBikes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                    No bikes found
                  </TableCell>
                </TableRow>
              ) : (
                filteredBikes.map((bike) => (
                  <TableRow key={bike.id}>
                    <TableCell>
                      <Checkbox
                        checked={labelSel.selected.has(bike.id)}
                        onCheckedChange={() => labelSel.toggle(bike.id)}
                      />
                    </TableCell>
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
                        <div className="text-xs font-mono text-muted-foreground">{bikeRef(bike as any)}</div>
                        {bike.year && (
                          <div className="text-sm text-muted-foreground">{bike.year}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(bike.status)}</TableCell>
                    <TableCell>{getSourceBadge(bike.source)}</TableCell>
                    <TableCell>
                      <LocationSelect
                        bikeId={bike.id}
                        value={bike.storage_bay_id}
                        onChange={(bayId) => handleLocationChange(bike.id, bayId)}
                        size="sm"
                      />
                    </TableCell>
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
                      <Button variant="outline" size="sm" onClick={() => onEdit(bike)}>
                        <Eye className="h-4 w-4" />
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
  );
}
