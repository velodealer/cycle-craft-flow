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
      // One server step: credit on the bike, new stock row, slot cleared.
      const { error } = await supabase.rpc('strip_component' as any, {
        p: { bike_id: bikeId, slot, slot_label: slotLabel, label, brand: component.brand ?? null, mpn: component.mpn ?? null, value: Number(value) },
      });
      if (error) throw error;

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
