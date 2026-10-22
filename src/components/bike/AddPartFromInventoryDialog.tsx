import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { logActivity } from '@/lib/activity';
import { tryPostFitPartToQuickBooks } from '@/lib/quickbooks';
import { tryPostFitPartToXero } from '@/lib/xero';

export interface FitSlot {
  slot: string;
  label: string;
  categorySlug?: string;
  position?: string | null;
  /** Component currently in this slot, if any. */
  currentComponent?: { id: string; brand?: string | null; model?: string | null; mpn?: string | null } | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  bikeId: string;
  onSaved: () => void;
  /** When set, the part is also put into this spec slot. */
  slot?: FitSlot | null;
}

export default function AddPartFromInventoryDialog({ open, onOpenChange, bikeId, onSaved, slot }: Props) {
  const { toast } = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<any | null>(null);
  const [value, setValue] = useState<number | ''>('');
  const [returnOld, setReturnOld] = useState(true);
  const [oldValue, setOldValue] = useState<number | ''>('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('parts')
      .select('*')
      .is('bike_id', null)
      .eq('stock_status', 'in_stock' as any)
      .order('created_at', { ascending: false });
    if (error) toast({ title: 'Could not load parts stock', description: error.message, variant: 'destructive' });
    setItems(data || []);
  }, [toast]);

  useEffect(() => {
    if (open) {
      setSelected(null); setSearch(''); setValue(''); setReturnOld(true); setOldValue('');
      load();
    }
  }, [open, load]);

  useEffect(() => { if (selected) setValue(selected.cost_price ?? ''); }, [selected]);

  const filtered = items.filter((p) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return p.description?.toLowerCase().includes(q) || p.brand?.toLowerCase().includes(q) || p.part_number?.toLowerCase().includes(q);
  });

  const current = slot?.currentComponent ?? null;
  const currentLabel = current ? [current.brand, current.model].filter(Boolean).join(' ') || slot?.label : '';

  const save = async () => {
    if (!selected) return toast({ title: 'Select a part', variant: 'destructive' });
    if (value === '' || Number(value) < 0) return toast({ title: 'Enter a valid cost', variant: 'destructive' });
    if (current && returnOld && (oldValue === '' || Number(oldValue) < 0)) {
      return toast({ title: 'Enter a value for the part going back to stock', variant: 'destructive' });
    }
    setSaving(true);
    try {
      const cost = Number(value);
      // One server step: old part back to stock, new part onto the bike, spec slot and history.
      const { error } = await supabase.rpc('fit_stock_part' as any, {
        p: {
          bike_id: bikeId, part_id: selected.id, cost,
          slot: slot?.slot ?? null, slot_label: slot?.label ?? null, position: slot?.position ?? null,
          category_slug: slot?.categorySlug ?? null,
          return_old: !!(slot && current && returnOld),
          old_value: current && returnOld ? Math.abs(Number(oldValue)) : null,
          old_credit_desc: slot && current ? `Stripped: ${slot.label} — ${currentLabel}` : null,
          old_inventory_desc: slot && current ? `${slot.label}: ${currentLabel}` : null,
          old_brand: current?.brand ?? null, old_mpn: current?.mpn ?? null,
        },
      });
      if (error) throw error;

      toast({ title: 'Part fitted to bike' });
      onOpenChange(false);
      onSaved();

      // Accounting runs independently and never blocks the fit.
      void Promise.all([tryPostFitPartToQuickBooks(selected.id), tryPostFitPartToXero(selected.id)]).then(([qb, xe]) => {
        const failed = [!qb.ok && `QuickBooks: ${qb.error}`, !xe.ok && `Xero: ${(xe as any).error}`].filter(Boolean);
        if (failed.length) toast({ title: 'Part fitted, but accounts not updated', description: failed.join(' · '), variant: 'destructive' });
      });
    } catch (e: any) {
      toast({ title: 'Failed to fit part', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{slot ? `Fit ${slot.label.toLowerCase()} from stock` : 'Add part from inventory'}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Input placeholder="Search description, brand or part number…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <div className="border rounded-md max-h-64 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">No matching parts in stock.</p>
            ) : filtered.map((p) => (
              <button key={p.id} type="button" onClick={() => setSelected(p)}
                className={`w-full text-left p-3 border-b last:border-b-0 hover:bg-accent ${selected?.id === p.id ? 'bg-accent' : ''}`}>
                <div className="flex justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium">{p.description}</div>
                    <div className="text-xs text-muted-foreground">{[p.brand, p.part_number].filter(Boolean).join(' • ') || '—'}</div>
                  </div>
                  <div className="text-sm whitespace-nowrap">£{Number(p.cost_price ?? 0).toFixed(2)}</div>
                </div>
              </button>
            ))}
          </div>
          {selected && (
            <div>
              <Label>Cost to fit to bike (£)</Label>
              <Input type="number" step="0.01" min={0} value={value}
                onChange={(e) => setValue(e.target.value === '' ? '' : parseFloat(e.target.value))} />
              <p className="text-xs text-muted-foreground mt-1">Added to the bike's parts cost and removed from parts stock.</p>
            </div>
          )}
          {current && (
            <div className="rounded-md border p-3 space-y-2">
              <p className="text-sm">Currently fitted: <span className="font-medium">{currentLabel}</span></p>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={returnOld} onCheckedChange={(v) => setReturnOld(!!v)} />
                Send it back to parts stock (untick to discard)
              </label>
              {returnOld && (
                <div>
                  <Label>Its value in stock (£)</Label>
                  <Input type="number" step="0.01" min={0} value={oldValue}
                    onChange={(e) => setOldValue(e.target.value === '' ? '' : parseFloat(e.target.value))} />
                </div>
              )}
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
