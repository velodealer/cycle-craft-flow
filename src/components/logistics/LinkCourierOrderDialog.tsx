import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { Link2 } from 'lucide-react';

interface Props {
  bikeId?: string;
  direction?: 'inbound' | 'outbound';
  onLinked?: () => void;
  triggerLabel?: string;
}

export default function LinkCourierOrderDialog({ bikeId, direction: fixedDirection, onLinked, triggerLabel = 'Link existing booking' }: Props) {
  const [open, setOpen] = useState(false);
  const [bikes, setBikes] = useState<{ id: string; reference: string | null; make: string; model: string }[]>([]);
  const [search, setSearch] = useState('');
  const [selectedBike, setSelectedBike] = useState(bikeId ?? '');
  const [direction, setDirection] = useState<'inbound' | 'outbound'>(fixedDirection ?? 'inbound');
  const [order, setOrder] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || bikeId) return;
    supabase.from('bikes').select('id, reference, make, model').order('created_at', { ascending: false }).limit(1000)
      .then(({ data }) => setBikes((data as any) ?? []));
  }, [open, bikeId]);

  const q = search.trim().toLowerCase();
  const filtered = bikes.filter((b) => !q || `${b.reference ?? ''} ${b.make} ${b.model}`.toLowerCase().includes(q)).slice(0, 50);

  const submit = async () => {
    if (!selectedBike || !order.trim()) {
      toast({ title: 'Pick a bike and paste the order link', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('cycle-courier-link-order', {
        body: { bike_id: selectedBike, direction, order: order.trim() },
      });
      const msg = (data as any)?.error;
      if (msg) throw new Error(msg);
      if (error) {
        let detail = error.message;
        try { detail = (await (error as any).context?.json())?.error ?? detail; } catch { /* keep */ }
        throw new Error(detail);
      }
      toast({ title: 'Booking linked', description: (data as any)?.tracking_number ? `Tracking ${(data as any).tracking_number}` : 'Status will update automatically.' });
      setOpen(false);
      setOrder('');
      onLinked?.();
    } catch (e: any) {
      toast({ title: 'Could not link booking', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm"><Link2 className="h-4 w-4 mr-1" />{triggerLabel}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Link a Cycle Courier Co booking</DialogTitle>
          <DialogDescription>For jobs booked directly with Cycle Courier Co. Status and tracking will then update automatically.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {!bikeId && (
            <div className="space-y-2">
              <Label>Bike</Label>
              <Input placeholder="Search by reference, make or model" value={search} onChange={(e) => setSearch(e.target.value)} />
              <Select value={selectedBike} onValueChange={setSelectedBike}>
                <SelectTrigger><SelectValue placeholder="Choose a bike" /></SelectTrigger>
                <SelectContent>
                  {filtered.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.reference ?? '—'} · {b.make} {b.model}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {!fixedDirection && (
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={direction} onValueChange={(v) => setDirection(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="inbound">Collection (coming in)</SelectItem>
                  <SelectItem value="outbound">Delivery (going out)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="ccc-order">Order link or order number</Label>
            <Input id="ccc-order" placeholder="https://booking.cyclecourierco.com/orders/…" value={order} onChange={(e) => setOrder(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? 'Linking…' : 'Link booking'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
