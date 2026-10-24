import { useEffect, useState } from 'react';
import { Truck, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const empty = { name: '', email: '', phone: '', street: '', city: '', postcode: '', country: 'UK', instructions: '' };

/** Books a Cycle Courier delivery after the sale, e.g. when the customer switches from collection to delivery. */
export default function BookDeliveryDialog({ bikeId, onBooked }: { bikeId: string; onBooked: () => void }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(empty);
  const [override, setOverride] = useState('');
  const [needsOverride, setNeedsOverride] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data } = await supabase
        .from('invoices')
        .select('external_owners:external_customer_id(name, email, phone, address)')
        .eq('bike_id', bikeId).eq('type', 'sale')
        .order('created_at', { ascending: false }).limit(1).maybeSingle();
      const c = (data as any)?.external_owners;
      if (!c) return;
      const parts = String(c.address ?? '').split(/\n|,/).map((s: string) => s.trim()).filter(Boolean);
      setF((p) => ({
        ...p,
        name: p.name || c.name || '',
        email: p.email || c.email || '',
        phone: p.phone || c.phone || '',
        street: p.street || parts.slice(0, Math.max(1, parts.length - 2)).join(', '),
        city: p.city || (parts.length >= 3 ? parts[parts.length - 2] : ''),
        postcode: p.postcode || (parts.length >= 2 ? parts[parts.length - 1] : ''),
      }));
    })();
  }, [open, bikeId]);

  const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setF((p) => ({ ...p, [k]: e.target.value }));

  const submit = async () => {
    if (!f.name.trim() || !f.street.trim() || !f.city.trim() || !f.postcode.trim()) {
      toast.error('Name, street, city and postcode are needed');
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.functions.invoke('create-delivery-order', {
      body: {
        bike_id: bikeId,
        receiver_name: f.name.trim(), receiver_email: f.email.trim(), receiver_phone: f.phone.trim(),
        receiver_street: f.street.trim(), receiver_city: f.city.trim(), receiver_postcode: f.postcode.trim(),
        receiver_country: f.country.trim() || 'UK', delivery_instructions: f.instructions.trim(),
        override_reason: override.trim() || undefined,
      },
    });
    setBusy(false);
    const err = (data as any)?.error ?? (error ? await (error as any).context?.json?.().then((j: any) => j?.error).catch(() => null) ?? error.message : null);
    if (err) {
      if ((data as any)?.deferred_jobs || /deferred/i.test(err)) setNeedsOverride(true);
      toast.error(err);
      return;
    }
    toast.success('Delivery booked with Cycle Courier Co');
    setOpen(false);
    onBooked();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Truck className="mr-1 h-4 w-4" />Book delivery</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Book delivery instead of collection</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2"><Label>Customer name</Label><Input value={f.name} onChange={set('name')} /></div>
          <div><Label>Email</Label><Input type="email" value={f.email} onChange={set('email')} /></div>
          <div><Label>Phone</Label><Input value={f.phone} onChange={set('phone')} /></div>
          <div className="sm:col-span-2"><Label>Street</Label><Input value={f.street} onChange={set('street')} /></div>
          <div><Label>City</Label><Input value={f.city} onChange={set('city')} /></div>
          <div><Label>Postcode</Label><Input value={f.postcode} onChange={set('postcode')} /></div>
          <div className="sm:col-span-2"><Label>Instructions (optional)</Label><Textarea value={f.instructions} onChange={set('instructions')} /></div>
          {needsOverride && (
            <div className="sm:col-span-2">
              <Label>Reason to book with postponed jobs open (owner/admin)</Label>
              <Input value={override} onChange={(e) => setOverride(e.target.value)} />
            </div>
          )}
        </div>
        <p className="text-xs text-muted-foreground">The invoice isn't changed. Add a delivery charge to it separately if the customer is paying for delivery.</p>
        <DialogFooter>
          <Button onClick={submit} disabled={busy}>{busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Book delivery</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
