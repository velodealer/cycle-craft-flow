import { Checkbox } from '@/components/ui/checkbox';
import PrintLabelsButton from '@/components/bike/PrintLabelsButton';
import { useLabelSelection } from '@/hooks/useLabelSelection';
import { bikeRef } from '@/lib/bikeReference';
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import BikeThumbnail from '@/components/bike/BikeThumbnail';
import LocationSelect from '@/components/bike/LocationSelect';
import { ListCard, ListCardRow, ListCardActions, ListEmpty } from '@/components/ui/list-card';
import { useStorageBays } from '@/hooks/useStorageBays';
import { StageFlap } from '@/components/velo/StageFlap';
import { MarginTriple } from '@/components/velo/MarginTriple';

interface Bike {
  id: string;
  reference: string | null;
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
  serial_number?: string | null;
  size?: string | null;
}

// Sizes are stored as free text in mixed formats ("54cm", "54", "M - 54", "Large").
// Reduce each to a canonical key so equivalent formats group together:
// frame sizes match on their two-digit number, letter sizes on their letter/word form.
const canonicalSize = (raw: string | null | undefined): string | null => {
  const s = (raw || '').toLowerCase().trim();
  if (!s) return null;
  const num = s.match(/\d{2}/);
  if (num) return `num:${num[0]}`;
  if (/3xs|xxxs/.test(s)) return 'l:3xs';
  if (/2xs|xxs/.test(s)) return 'l:2xs';
  if (/\bxs\b|extra small|x-small/.test(s)) return 'l:xs';
  if (/\bs\b|small/.test(s)) return 'l:s';
  if (/\bm\b|medium/.test(s)) return 'l:m';
  if (/2xl|xxl/.test(s)) return 'l:2xl';
  if (/\bxl\b|x-large|extra large/.test(s)) return 'l:xl';
  if (/\bl\b|\blg\b|large/.test(s)) return 'l:l';
  return `raw:${s}`;
};


interface BikeListProps {
  onEdit: (bike: Bike) => void;
  onAdd: () => void;
}

export default function BikeList({ onEdit, onAdd }: BikeListProps) {
  const PAGE_SIZE = 25;
  const [bikes, setBikes] = useState<Bike[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');
  const [sizeFilter, setSizeFilter] = useState('all');
  const [page, setPage] = useState(1);
  const { bays } = useStorageBays();

  const loadBikes = async () => {
    try {
      let query = supabase
        .from('bikes')
        .select('id, reference, make, model, year, status, source, asking_price, sale_price, created_at, photos, storage_bay_id, frame_number, serial_number, size')
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

  useEffect(() => {
    setPage(1);
  }, [searchTerm, statusFilter, sourceFilter, locationFilter, sizeFilter]);

  const bayName = (id: string | null) => {
    if (!id) return null;
    const bay = bays.find((b) => b.id === id);
    if (!bay) return null;
    return bay.zone ? `${bay.zone} · ${bay.name}` : bay.name;
  };

  const sizeOptions = useMemo(() => {
    const byKey = new Map<string, { label: string; count: number }>();
    bikes.forEach((b) => {
      const raw = (b.size || '').trim();
      if (!raw) return;
      const key = canonicalSize(raw);
      if (!key) return;
      const existing = byKey.get(key);
      if (existing) existing.count += 1;
      else byKey.set(key, { label: raw, count: 1 });
    });
    return Array.from(byKey.entries())
      .map(([key, v]) => ({ key, label: v.label, count: v.count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  }, [bikes]);

  const filteredBikes = bikes.filter((bike) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      searchTerm === '' ||
      bike.make.toLowerCase().includes(term) ||
      bike.model.toLowerCase().includes(term) ||
      bike.id.toLowerCase().includes(term) ||
      `${bike.make} ${bike.model}`.toLowerCase().includes(term) ||
      bike.frame_number?.toLowerCase().includes(term) ||
      (bike as any).serial_number?.toLowerCase().includes(term) ||
      (bike as any).reference?.toLowerCase().includes(term);

    const matchesLocation =
      locationFilter === 'all' ||
      (locationFilter === 'unassigned' ? !bike.storage_bay_id : bike.storage_bay_id === locationFilter);

    const matchesSize =
      sizeFilter === 'all' ||
      (sizeFilter === 'none'
        ? !(bike.size || '').trim()
        : canonicalSize(bike.size) === sizeFilter);

    return matchesSearch && matchesLocation && matchesSize;
  });

  const pageCount = Math.max(1, Math.ceil(filteredBikes.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visibleBikes = filteredBikes.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const labelSel = useLabelSelection(filteredBikes.map((b: any) => b.id));

  const handleLocationChange = (bikeId: string, bayId: string | null) => {
    setBikes((prev) => prev.map((b) => (b.id === bikeId ? { ...b, storage_bay_id: bayId } : b)));
  };

  const getStatusBadge = (status: string) => <StageFlap stage={status} />;

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
        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <div className="relative sm:col-span-2 xl:col-span-2">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search bikes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full">
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
            <SelectTrigger className="w-full">
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
            <SelectTrigger className="w-full">
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
          <Select value={sizeFilter} onValueChange={setSizeFilter}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Filter by size" />
            </SelectTrigger>
            <SelectContent className="bg-popover z-50">
              <SelectItem value="all">All Sizes</SelectItem>
              <SelectItem value="none">Not recorded</SelectItem>
              {sizeOptions.map((opt) => (
                <SelectItem key={opt.key} value={opt.key}>
                  {opt.label}
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
            visibleBikes.map((bike) => (
              <ListCard key={bike.id}>
                <div className="flex gap-3">
                  <Checkbox
                    className="mt-1"
                    checked={labelSel.selected.has(bike.id)}
                    onCheckedChange={() => labelSel.toggle(bike.id)}
                  />
                   <button type="button" className="shrink-0" onClick={() => onEdit(bike)} aria-label={`Open ${bike.make} ${bike.model}`}>
                     <BikeThumbnail photos={bike.photos} alt={`${bike.make} ${bike.model}`} className="h-20 w-20" />
                   </button>
                  <div className="min-w-0 flex-1 space-y-2">
                     <button type="button" className="block text-left font-semibold leading-tight break-words hover:underline" onClick={() => onEdit(bike)}>
                      {bike.make} {bike.model}
                      {bike.year ? <span className="text-muted-foreground"> · {bike.year}</span> : null}
                     </button>
                    <div className="id-text">{bikeRef(bike as any)}</div>
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

              </ListCard>
            ))
          )}
        </div>

        {/* Desktop table */}
        <div className="hidden lg:block rounded-md border overflow-hidden">
          <Table className="table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"></TableHead>
                <TableHead className="w-[38%]">Bike</TableHead>
                <TableHead className="w-[17%]">Stage</TableHead>
                <TableHead className="w-[25%]">Location</TableHead>
                <TableHead className="w-[20%] text-right">Prices</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredBikes.length === 0 ? (
                <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    No bikes found
                  </TableCell>
                </TableRow>
              ) : (
                visibleBikes.map((bike) => (
                  <TableRow key={bike.id}>
                    <TableCell>
                      <Checkbox
                        checked={labelSel.selected.has(bike.id)}
                        onCheckedChange={() => labelSel.toggle(bike.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex min-w-0 items-center gap-3">
                        <button type="button" className="shrink-0" onClick={() => onEdit(bike)} aria-label={`Open ${bike.make} ${bike.model}`}>
                          <BikeThumbnail photos={bike.photos} alt={`${bike.make} ${bike.model}`} className="h-12 w-12" />
                        </button>
                        <div className="min-w-0">
                        <button type="button" className="block text-left font-medium break-words hover:underline" onClick={() => onEdit(bike)}>
                          {bike.year ? `${bike.year} ` : ''}{bike.make} {bike.model}
                        </button>
                        <div className="id-text">{bikeRef(bike as any)}</div>
                        <div className="mt-1">{getSourceBadge(bike.source)}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(bike.status)}</TableCell>
                    <TableCell>
                      <LocationSelect
                        bikeId={bike.id}
                        value={bike.storage_bay_id}
                        onChange={(bayId) => handleLocationChange(bike.id, bayId)}
                        size="sm"
                      />
                    </TableCell>
                    <TableCell className="text-right text-sm tabular">
                      <div>{bike.asking_price ? `Ask £${bike.asking_price.toFixed(0)}` : 'Ask £—'}</div>
                      <div className="text-muted-foreground">{bike.sale_price ? `Sale £${bike.sale_price.toFixed(0)}` : `Added ${new Date(bike.created_at).toLocaleDateString('en-GB')}`}</div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="hidden space-y-3 md:block lg:hidden">
          {visibleBikes.map((bike) => (
            <ListCard key={bike.id}>
              <div className="grid grid-cols-[auto_minmax(0,1fr)_minmax(9rem,0.8fr)] items-start gap-4">
                <Checkbox checked={labelSel.selected.has(bike.id)} onCheckedChange={() => labelSel.toggle(bike.id)} />
                <div className="flex min-w-0 gap-3">
                  <button type="button" className="shrink-0" onClick={() => onEdit(bike)}><BikeThumbnail photos={bike.photos} alt={`${bike.make} ${bike.model}`} className="h-14 w-14" /></button>
                  <div className="min-w-0"><button type="button" className="text-left font-semibold hover:underline" onClick={() => onEdit(bike)}>{bike.year ? `${bike.year} ` : ''}{bike.make} {bike.model}</button><div className="id-text">{bikeRef(bike as any)}</div><div className="mt-1 flex flex-wrap gap-2">{getStatusBadge(bike.status)}{getSourceBadge(bike.source)}</div></div>
                </div>
                <LocationSelect bikeId={bike.id} value={bike.storage_bay_id} onChange={(bayId) => handleLocationChange(bike.id, bayId)} size="sm" />
              </div>
            </ListCard>
          ))}
        </div>

        {filteredBikes.length > 0 && (
          <div className="mt-4 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filteredBikes.length)} of {filteredBikes.length}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>
                <ChevronLeft className="mr-1 h-4 w-4" /> Previous
              </Button>
              <span className="text-sm tabular">Page {currentPage} of {pageCount}</span>
              <Button variant="outline" size="sm" disabled={currentPage === pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))}>
                Next <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
