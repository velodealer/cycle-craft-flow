import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  bikeId: string;
  onSaved: () => void;
}

export default function AddPartFromInventoryDialog({ open, onOpenChange, bikeId, onSaved }: Props) {
  const { toast } = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<any | null>(null);
  const [value, setValue] = useState<number | ''>('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('parts')
      .select('*')
      .is('bike_id', null)
      .eq('stock_status', 'in_stock' as any)
      .order('created_at', { ascending: false });
    setItems(data || []);
  }, []);

  useEffect(() => {
    if (open) {
      setSelected(null);
      setSearch('');
      setValue('');
      load();
    }
  }, [open, load]);

  useEffect(() => {
    if (selected) setValue(selected.cost_price ?? '');
  }, [selected]);

  const filtered = items.filter((p) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      p.description?.toLowerCase().includes(q) ||
      p.brand?.toLowerCase().includes(q) ||
      p.part_number?.toLowerCase().includes(q)
    );
  });

  const save = async () => {
    if (!selected) return toast({ title: 'Select a part', variant: 'destructive' });
    if (value === '' || Number(value) < 0) return toast({ title: 'Enter a valid value', variant: 'destructive' });
    setSaving(true);
    const { error } = await supabase
      .from('parts')
      .update({
        bike_id: bikeId,
        stock_status: 'sold' as any,
        cost_price: Number(value),
      } as any)
      .eq('id', selected.id);
    setSaving(false);
    if (error) return toast({ title: 'Failed to fit part', description: error.message, variant: 'destructive' });
    toast({ title: 'Part fitted to bike' });
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Add part from inventory</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Input placeholder="Search description, brand or part number…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <div className="border rounded-md max-h-64 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">No matching parts in stock.</p>
            ) : (
              filtered.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelected(p)}
                  className={`w-full text-left p-3 border-b last:border-b-0 hover:bg-accent ${selected?.id === p.id ? 'bg-accent' : ''}`}
                >
                  <div className="flex justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium">{p.description}</div>
                      <div className="text-xs text-muted-foreground">
                        {[p.brand, p.part_number].filter(Boolean).join(' • ') || '—'}
                      </div>
                    </div>
                    <div className="text-sm whitespace-nowrap">£{Number(p.cost_price ?? 0).toFixed(2)}</div>
                  </div>
                </button>
              ))
            )}
          </div>
          {selected && (
            <div>
              <Label>Cost to fit to bike (£)</Label>
              <Input
                type="number"
                step="0.01"
                min={0}
                value={value}
                onChange={(e) => setValue(e.target.value === '' ? '' : parseFloat(e.target.value))}
              />
              <p className="text-xs text-muted-foreground mt-1">Added to the bike's parts cost and removed from inventory.</p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving || !selected}>{saving ? 'Saving…' : 'Fit to bike'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
