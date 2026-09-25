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
      // 1. Old part in this slot goes back to stock (same as stripping it).
      if (slot && current && returnOld) {
        const v = Math.abs(Number(oldValue));
        const { error: cErr } = await supabase.from('parts').insert({
          bike_id: bikeId, description: `Stripped: ${slot.label} — ${currentLabel}`, brand: current.brand || null,
          cost_price: -v, quantity: 1, stock_status: 'sold' as any, type: 'secondhand_stripped' as any,
        } as any);
        if (cErr) throw cErr;
        const { error: iErr } = await supabase.from('parts').insert({
          description: `${slot.label}: ${currentLabel}`, brand: current.brand || null, part_number: current.mpn || null,
          cost_price: v, quantity: 1, stripped_from_bike_id: bikeId, stock_status: 'in_stock' as any, type: 'secondhand_stripped' as any,
        } as any);
        if (iErr) throw iErr;
      }

      // 2. Part leaves stock and its cost lands on the bike.
      const { data: moved, error } = await supabase.from('parts')
        .update({ bike_id: bikeId, stock_status: 'sold' as any, cost_price: cost } as any)
        .eq('id', selected.id).is('bike_id', null).eq('stock_status', 'in_stock' as any)
        .select('id');
      if (error) throw error;
      if (!moved?.length) throw new Error('That part is no longer in stock');

      // 3. Put it into the spec slot.
      if (slot) {
        const brand = (selected.brand || '').trim() || 'Unbranded';
        const model = (selected.description || '').replace(/^[^:]+:\s*/, '').trim() || slot.label;
        const mpn = (selected.part_number || '').trim() || null;
        const { data: cat } = await supabase.from('component_categories').select('id')
          .in('slug', [slot.categorySlug || 'accessories', 'accessories']);
        const catId = cat?.[0]?.id;
        if (!catId) throw new Error('Component category not found');
        let q = supabase.from('components').select('id').eq('category_id', catId).eq('brand', brand).eq('model', model);
        q = mpn ? q.eq('mpn', mpn) : q.is('mpn', null);
        const { data: existing, error: fErr } = await q.limit(1);
        if (fErr) throw fErr;
        let componentId = existing?.[0]?.id as string | undefined;
        if (!componentId) {
          const { data: created, error: nErr } = await supabase.from('components')
            .insert({ category_id: catId, brand, model, mpn, source: 'manual' } as any).select('id').single();
          if (nErr) throw nErr;
          componentId = created.id;
        }
        const { error: lErr } = await supabase.from('bike_components').upsert({
          bike_id: bikeId, slot: slot.slot, component_id: componentId, position: slot.position || null,
          brand: null, model: null, mpn: null, attributes: null, spec_overrides: null, notes: null,
        } as any, { onConflict: 'bike_id,slot' });
        if (lErr) throw lErr;
      }

      logActivity(bikeId, {
        kind: 'cost' as any, action: 'part_fitted',
        summary: `Fitted from stock: ${[selected.brand, selected.description].filter(Boolean).join(' ')}${slot ? ` (${slot.label})` : ''}`,
        detail: { part_id: selected.id, cost, slot: slot?.slot ?? null, returned_old: !!(current && returnOld) },
      });

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
