import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  bikeId: string;
  slot: string;
  slotLabel: string;
  componentId: string | null;
  onDone: () => void;
}

export default function StripComponentDialog({ open, onOpenChange, bikeId, slot, slotLabel, componentId, onDone }: Props) {
  const { toast } = useToast();
  const [component, setComponent] = useState<any>(null);
  const [value, setValue] = useState<number | ''>('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !componentId) return;
    setValue('');
    setNotes('');
    supabase.from('components').select('*').eq('id', componentId).maybeSingle()
      .then(({ data }) => setComponent(data));
  }, [open, componentId]);

  const save = async () => {
    if (value === '' || Number(value) < 0) {
      return toast({ title: 'Enter a valid value', variant: 'destructive' });
    }
    if (!component) return;
    setSaving(true);
    const label = [component.brand, component.model].filter(Boolean).join(' ') || slotLabel;
    try {
      // 1. Credit row on the bike (negative cost) — reduces bike parts cost
      const { error: creditErr } = await supabase.from('parts').insert({
        bike_id: bikeId,
        description: `Stripped: ${slotLabel} — ${label}`,
        brand: component.brand || null,
        cost_price: -Math.abs(Number(value)),
        quantity: 1,
        stock_status: 'sold' as any,
        type: 'secondhand_stripped' as any,
      } as any);
      if (creditErr) throw creditErr;

      // 2. New inventory row at the entered value
      const { error: invErr } = await supabase.from('parts').insert({
        description: `${slotLabel}: ${label}`,
        brand: component.brand || null,
        part_number: component.mpn || null,
        cost_price: Number(value),
        quantity: 1,
        stripped_from_bike_id: bikeId,
        stock_status: 'in_stock' as any,
        type: 'secondhand_stripped' as any,
      } as any);
      if (invErr) throw invErr;

      // 3. Unlink the component from this bike slot
      const { error: delErr } = await supabase
        .from('bike_components')
        .delete()
        .eq('bike_id', bikeId)
        .eq('slot', slot);
      if (delErr) throw delErr;

      toast({ title: 'Component stripped to inventory' });
      onOpenChange(false);
      onDone();
    } catch (e: any) {
      toast({ title: 'Failed to strip component', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Strip {slotLabel} to inventory</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="rounded-md border p-3 text-sm">
            <div className="font-medium">{component ? `${component.brand || ''} ${component.model || ''}`.trim() : 'Loading…'}</div>
            {component?.mpn && <div className="text-xs text-muted-foreground">MPN: {component.mpn}</div>}
          </div>
          <div>
            <Label>Inventory value (£)</Label>
            <Input
              type="number"
              step="0.01"
              min={0}
              value={value}
              onChange={(e) => setValue(e.target.value === '' ? '' : parseFloat(e.target.value))}
              autoFocus
            />
            <p className="text-xs text-muted-foreground mt-1">
              Reduces this bike's parts cost by the same amount and creates an in-stock part at this value.
            </p>
          </div>
          <div>
            <Label>Notes (optional)</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving || !component}>{saving ? 'Saving…' : 'Strip to inventory'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
