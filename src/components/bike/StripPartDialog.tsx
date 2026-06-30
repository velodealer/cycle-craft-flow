import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  part: any | null;
  bikeId: string;
  onSaved: () => void;
}

export default function StripPartDialog({ open, onOpenChange, part, bikeId, onSaved }: Props) {
  const { toast } = useToast();
  const [value, setValue] = useState<number | ''>('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && part) setValue(part.cost_price ?? '');
  }, [open, part]);

  const save = async () => {
    if (!part) return;
    if (value === '' || Number(value) < 0) {
      return toast({ title: 'Enter a valid value', variant: 'destructive' });
    }
    setSaving(true);
    const { error } = await supabase
      .from('parts')
      .update({
        bike_id: null,
        stripped_from_bike_id: bikeId,
        stock_status: 'in_stock' as any,
        type: 'secondhand_stripped' as any,
        cost_price: Number(value),
        quantity: 1,
      } as any)
      .eq('id', part.id);
    setSaving(false);
    if (error) return toast({ title: 'Failed to strip part', description: error.message, variant: 'destructive' });
    toast({ title: 'Part moved to inventory' });
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Strip part to inventory</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Removes <span className="font-medium text-foreground">{part?.description}</span> from this bike's
            cost and adds it back to the parts inventory at the value you set below.
          </p>
          <div>
            <Label>Inventory value (£)</Label>
            <Input
              type="number"
              step="0.01"
              min={0}
              value={value}
              onChange={(e) => setValue(e.target.value === '' ? '' : parseFloat(e.target.value))}
            />
            <p className="text-xs text-muted-foreground mt-1">
              This value is deducted from the bike's total cost and becomes the part's stock cost.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Strip to inventory'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
