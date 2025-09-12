import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, Plus, Edit, Mail, Phone } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface Owner {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  preferred_contact: string | null;
  address: string | null;
  created_at: string;
}

interface OwnerListProps {
  onEdit: (owner: Owner) => void;
  onAdd: () => void;
}

export default function OwnerList({ onEdit, onAdd }: OwnerListProps) {
  const [owners, setOwners] = useState<Owner[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const loadOwners = async () => {
    try {
      const { data, error } = await supabase
        .from('external_owners')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOwners(data || []);
    } catch (error: any) {
      toast({
        title: 'Error loading owners',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOwners();
  }, []);

  const filteredOwners = owners.filter(owner =>
    searchTerm === '' ||
    owner.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (owner.email && owner.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (owner.phone && owner.phone.includes(searchTerm))
  );

  const getContactBadge = (method: string | null) => {
    if (!method) return null;
    
    const variants: Record<string, 'default' | 'secondary' | 'outline'> = {
      'email': 'default',
      'sms': 'secondary',
      'whatsapp': 'outline'
    };

    return (
      <Badge variant={variants[method] || 'outline'}>
        {method.charAt(0).toUpperCase() + method.slice(1)}
      </Badge>
    );
  };

  if (loading) {
    return <div className="flex justify-center p-8">Loading owners...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Owners ({filteredOwners.length})</CardTitle>
          <Button onClick={onAdd}>
            <Plus className="h-4 w-4 mr-2" />
            Add Owner
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search owners..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Preferred Method</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Added</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOwners.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No owners found
                  </TableCell>
                </TableRow>
              ) : (
                filteredOwners.map((owner) => (
                  <TableRow key={owner.id}>
                    <TableCell>
                      <div className="font-medium">{owner.name}</div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {owner.email && (
                          <div className="flex items-center gap-1 text-sm">
                            <Mail className="h-3 w-3" />
                            {owner.email}
                          </div>
                        )}
                        {owner.phone && (
                          <div className="flex items-center gap-1 text-sm">
                            <Phone className="h-3 w-3" />
                            {owner.phone}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {getContactBadge(owner.preferred_contact)}
                    </TableCell>
                    <TableCell>
                      <div className="max-w-32 truncate text-sm text-muted-foreground">
                        {owner.address || '-'}
                      </div>
                    </TableCell>
                    <TableCell>
                      {new Date(owner.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onEdit(owner)}
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