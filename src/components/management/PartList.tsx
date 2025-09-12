import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, Plus, Edit } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

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
}

interface PartListProps {
  onEdit: (part: Part) => void;
  onAdd: () => void;
}

export default function PartList({ onEdit, onAdd }: PartListProps) {
  const [parts, setParts] = useState<Part[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const loadParts = async () => {
    try {
      let query = supabase
        .from('parts')
        .select('*')
        .order('created_at', { ascending: false });

      if (typeFilter !== 'all') {
        query = query.eq('type', typeFilter as any);
      }
      if (statusFilter !== 'all') {
        query = query.eq('stock_status', statusFilter as any);
      }

      const { data, error } = await query;

      if (error) throw error;
      setParts(data || []);
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
    searchTerm === '' ||
    part.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (part.brand && part.brand.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (part.part_number && part.part_number.toLowerCase().includes(searchTerm.toLowerCase()))
  );

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
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
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
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Part</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Cost</TableHead>
                <TableHead>Sale Price</TableHead>
                <TableHead>Added</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredParts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    No parts found
                  </TableCell>
                </TableRow>
              ) : (
                filteredParts.map((part) => (
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
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onEdit(part)}
                      >
                        <Edit className="h-4 w-4" />
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