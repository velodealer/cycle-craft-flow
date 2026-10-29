import { useDebounce } from '@/hooks/useDebounce';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, Plus, Edit, Banknote, ChevronLeft, ChevronRight, Camera } from 'lucide-react';
import PartListingDialog from './PartListingDialog';
import { fetchAllRows } from '@/lib/fetchAll';

const PAGE_SIZE = 25;
import { toast } from '@/hooks/use-toast';
import { ListCard, ListCardRow, ListCardActions, ListEmpty } from '@/components/ui/list-card';
import { useStorageBays } from '@/hooks/useStorageBays';
import RecordPartSaleDialog, { type SellablePart } from './RecordPartSaleDialog';


interface Part {
  id: string;
  type: string;
  brand: string | null;
  description: string;
  part_number: string | null;
  cost_price: number | null;
  sale_price: number | null;
  quantity: number;
  stock_status: string;
  created_at: string;
  storage_bay_id: string | null;
  for_sale?: boolean;
  ebay_listing_status?: string | null;
  shopify_listing_status?: string | null;
  listing_photos?: string[] | null;
}

interface PartListProps {
  onEdit: (part: Part) => void;
  onAdd: () => void;
}

function listedBadge(part: Part) {
  const n = [part.ebay_listing_status, part.shopify_listing_status].filter((x) => x === 'listed').length;
  if (n) return <span className="ml-1 text-xs text-primary">· live {n}</span>;
  if (part.for_sale) return <span className="ml-1 text-xs text-muted-foreground">· for sale</span>;
  return null;
}

export default function PartList({ onEdit, onAdd }: PartListProps) {
  const [listingId, setListingId] = useState<string | null>(null);
  const [parts, setParts] = useState<Part[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const searchTerm = useDebounce(searchInput, 200);
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');
  const [sellingPart, setSellingPart] = useState<SellablePart | null>(null);
  const [sellOpen, setSellOpen] = useState(false);
  const [page, setPage] = useState(1);
  const { bays } = useStorageBays();

  const openSell = (part: Part) => {
    setSellingPart({
      id: part.id,
      description: part.description,
      brand: part.brand,
      cost_price: part.cost_price,
      sale_price: part.sale_price,
    });
    setSellOpen(true);
  };

  const loadParts = async () => {
    try {
      const data = await fetchAllRows<Part>((from, to) => {
        let query = supabase
          .from('parts')
          .select('*')
          .is('bike_id', null)
          .order('created_at', { ascending: false })
          .order('id');
        if (typeFilter !== 'all') query = query.eq('type', typeFilter as any);
        if (statusFilter !== 'all') query = query.eq('stock_status', statusFilter as any);
        return query.range(from, to) as any;
      });
      setParts(data);
    } catch (error: any) {
      toast({
        title: 'Error loading parts',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadParts();
  }, [typeFilter, statusFilter]);

  const filteredParts = parts.filter(part =>
    (locationFilter === 'all' || (locationFilter === 'unassigned' ? !part.storage_bay_id : part.storage_bay_id === locationFilter)) &&
    (searchTerm === '' ||
    part.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (part.brand && part.brand.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (part.part_number && part.part_number.toLowerCase().includes(searchTerm.toLowerCase())))
  );

  useEffect(() => { setPage(1); }, [searchTerm, typeFilter, statusFilter, locationFilter]);
  const pageCount = Math.max(1, Math.ceil(filteredParts.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visibleParts = filteredParts.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const locationName = (id: string | null) => {
    const bay = bays.find((item) => item.id === id);
    return bay ? (bay.zone ? `${bay.zone} · ${bay.name}` : bay.name) : 'Unassigned';
  };

  const getTypeBadge = (type: string) => {
    const labels: Record<string, string> = {
      'secondhand_bought': 'Secondhand (Bought)',
      'secondhand_stripped': 'Secondhand (Stripped)', 
      'new_resale': 'New (Resale)',
      'new_fitted': 'New (Fitted)'
    };

    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      'secondhand_bought': 'outline',
      'secondhand_stripped': 'secondary',
      'new_resale': 'default',
      'new_fitted': 'default'
    };

    return (
      <Badge variant={variants[type] || 'outline'}>
        {labels[type] || type}
      </Badge>
    );
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      'in_stock': 'default',
      'reserved': 'secondary',
      'sold': 'outline',
      'damaged': 'destructive'
    };

    const labels: Record<string, string> = {
      'in_stock': 'In Stock',
      'reserved': 'Reserved',
      'sold': 'Sold',
      'damaged': 'Damaged'
    };

    return (
      <Badge variant={variants[status] || 'outline'}>
        {labels[status] || status}
      </Badge>
    );
  };

  if (loading) {
    return <div className="flex justify-center p-8">Loading parts...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Parts Inventory ({filteredParts.length})</CardTitle>
          <Button onClick={onAdd}>
            <Plus className="h-4 w-4 mr-2" />
            Add Part
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search parts..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-full md:w-48">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="secondhand_bought">Secondhand (Bought)</SelectItem>
              <SelectItem value="secondhand_stripped">Secondhand (Stripped)</SelectItem>
              <SelectItem value="new_resale">New (Resale)</SelectItem>
              <SelectItem value="new_fitted">New (Fitted)</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full md:w-48">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="in_stock">In Stock</SelectItem>
              <SelectItem value="reserved">Reserved</SelectItem>
              <SelectItem value="sold">Sold</SelectItem>
              <SelectItem value="damaged">Damaged</SelectItem>
            </SelectContent>
          </Select>
          <Select value={locationFilter} onValueChange={setLocationFilter}>
            <SelectTrigger className="w-full md:w-48"><SelectValue placeholder="Filter by location" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Locations</SelectItem>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {bays.map((bay) => <SelectItem key={bay.id} value={bay.id}>{bay.zone ? `${bay.zone} · ${bay.name}` : bay.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Mobile cards */}
        <div className="space-y-3 md:hidden">
          {filteredParts.length === 0 ? (
            <ListEmpty message="No parts found" />
          ) : (
            visibleParts.map((part) => (
              <ListCard key={part.id}>
                <div className="space-y-1">
                  <div className="font-semibold leading-tight break-words">{part.description}</div>
                  {part.brand && (
                    <div className="text-sm text-muted-foreground">{part.brand}</div>
                  )}
                  {part.part_number && (
                    <div className="text-xs text-muted-foreground">#{part.part_number}</div>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {getTypeBadge(part.type)}
                  {getStatusBadge(part.stock_status)}
                </div>
                <ListCardRow label="Quantity" value={part.quantity} />
                <ListCardRow label="Location" value={locationName(part.storage_bay_id)} />
                <ListCardRow
                  label="Cost"
                  value={part.cost_price ? `£${part.cost_price.toFixed(2)}` : '—'}
                />
                <ListCardRow
                  label="Sale price"
                  value={part.sale_price ? `£${part.sale_price.toFixed(2)}` : '—'}
                />
                <ListCardRow label="Added" value={new Date(part.created_at).toLocaleDateString()} />
                <ListCardActions>
                  {part.stock_status === 'in_stock' && (
                    <Button variant="outline" className="w-full" onClick={() => setListingId(part.id)}>
                      <Camera className="h-4 w-4 mr-2" />
                      Photos & listing{listedBadge(part)}
                    </Button>
                  )}
                  {part.stock_status === 'in_stock' && (
                    <Button variant="outline" className="w-full" onClick={() => openSell(part)}>
                      <Banknote className="h-4 w-4 mr-2" />
                      Record sale
                    </Button>
                  )}
                  <Button variant="outline" className="w-full" onClick={() => onEdit(part)}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit part
                  </Button>
                </ListCardActions>
              </ListCard>
            ))
          )}
        </div>

        <div className="hidden md:block rounded-md border overflow-x-auto">
          <Table>

            <TableHeader>
              <TableRow>
                <TableHead>Part</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Cost</TableHead>
                <TableHead>Sale Price</TableHead>
                <TableHead>Added</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredParts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                    No parts found
                  </TableCell>
                </TableRow>
              ) : (
                visibleParts.map((part) => (
                  <TableRow key={part.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{part.description}</div>
                        {part.brand && (
                          <div className="text-sm text-muted-foreground">{part.brand}</div>
                        )}
                        {part.part_number && (
                          <div className="text-sm text-muted-foreground">#{part.part_number}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{getTypeBadge(part.type)}</TableCell>
                    <TableCell>{getStatusBadge(part.stock_status)}</TableCell>
                    <TableCell>{part.quantity}</TableCell>
                    <TableCell>{locationName(part.storage_bay_id)}</TableCell>
                    <TableCell>
                      {part.cost_price ? `£${part.cost_price.toFixed(2)}` : '-'}
                    </TableCell>
                    <TableCell>
                      {part.sale_price ? `£${part.sale_price.toFixed(2)}` : '-'}
                    </TableCell>
                    <TableCell>
                      {new Date(part.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {part.stock_status === 'in_stock' && (
                          <Button variant="outline" size="sm" title="Photos & listing" onClick={() => setListingId(part.id)}>
                            <Camera className="h-4 w-4" />{listedBadge(part)}
                          </Button>
                        )}
                        {part.stock_status === 'in_stock' && (
                          <Button variant="outline" size="sm" onClick={() => openSell(part)}>
                            <Banknote className="h-4 w-4" />
                          </Button>
                        )}
                        <Button variant="outline" size="sm" onClick={() => onEdit(part)}>
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
        {filteredParts.length > 0 && (
          <div className="mt-4 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filteredParts.length)} of {filteredParts.length}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setPage((v) => Math.max(1, v - 1))}>
                <ChevronLeft className="mr-1 h-4 w-4" /> Previous
              </Button>
              <span className="text-sm tabular">Page {currentPage} of {pageCount}</span>
              <Button variant="outline" size="sm" disabled={currentPage === pageCount} onClick={() => setPage((v) => Math.min(pageCount, v + 1))}>
                Next <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
      <RecordPartSaleDialog
        part={sellingPart}
        open={sellOpen}
        onOpenChange={setSellOpen}
        onDone={loadParts}
      />
      <PartListingDialog partId={listingId} open={!!listingId} onOpenChange={(v) => !v && setListingId(null)} onChanged={loadParts} />
    </Card>
  );
}