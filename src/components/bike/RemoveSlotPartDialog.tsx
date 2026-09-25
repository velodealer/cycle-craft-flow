import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { logActivity } from '@/lib/activity';
import { tryPostUnfitPartToQuickBooks } from '@/lib/quickbooks';
import { tryPostUnfitPartToXero } from '@/lib/xero';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  bikeId: string;
  slot: string;
  slotLabel: string;
  componentId: string;
  onDone: () => void;
}

/** Removing a part from a spec row: return it to parts stock (reversing a fit) or discard it. */
export default function RemoveSlotPartDialog({ open, onOpenChange, bikeId, slot, slotLabel, componentId, onDone }: Props) {
  const { toast } = useToast();
  const [component, setComponent] = useState<any>(null);
  const [fitted, setFitted] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'stock' | 'discard'>('stock');
  const [value, setValue] = useState<number | ''>('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [{ data: comp }, { data: acts }] = await Promise.all([
        supabase.from('components').select('*').eq('id', componentId).maybeSingle(),
        supabase.from('bike_activity').select('detail').eq('bike_id', bikeId).eq('action', 'part_fitted')
          .order('created_at', { ascending: false }).limit(50),
      ]);
      const partId = (acts || []).map((a: any) => a.detail).find((d: any) => d?.slot === slot)?.part_id;
      let part: any = null;
      if (partId) {
        const { data } = await supabase.from('parts').select('*').eq('id', partId)
          .eq('bike_id', bikeId).eq('stock_status', 'sold' as any).maybeSingle();
        part = data;
      }
      if (cancelled) return;
      setComponent(comp);
      setFitted(part);
      setMode(part ? 'stock' : 'discard');
      setValue(part ? Number(part.cost_price || 0) : '');
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [open, bikeId, slot, componentId]);

  const label = component ? [component.brand, component.model].filter(Boolean).join(' ') || slotLabel : slotLabel;

  const save = async () => {
    if (mode === 'stock' && (value === '' || Number(value) < 0)) {
      return toast({ title: 'Enter a valid value', variant: 'destructive' });
    }
    setSaving(true);
    try {
      const v = Number(value || 0);
      if (mode === 'stock' && fitted) {
        const original = Number(fitted.cost_price || 0);
        const { data: moved, error } = await supabase.from('parts')
          .update({ bike_id: null, stock_status: 'in_stock' as any, cost_price: v } as any)
          .eq('id', fitted.id).eq('bike_id', bikeId).select('id');
        if (error) throw error;
        if (!moved?.length) throw new Error('That part is no longer on this bike');
        // Any value lost (wear) stays as a cost on the bike.
        if (original - v > 0.005) {
          const { error: rErr } = await supabase.from('parts').insert({
            bike_id: bikeId, description: `Value lost on removed ${slotLabel.toLowerCase()} — ${label}`,
            brand: fitted.brand || null, cost_price: Math.round((original - v) * 100) / 100, quantity: 1,
            stock_status: 'sold' as any, type: 'secondhand_stripped' as any,
          } as any);
          if (rErr) throw rErr;
        }
      } else if (mode === 'stock') {
        const { error: cErr } = await supabase.from('parts').insert({
          bike_id: bikeId, description: `Stripped: ${slotLabel} — ${label}`, brand: component?.brand || null,
          cost_price: -Math.abs(v), quantity: 1, stock_status: 'sold' as any, type: 'secondhand_stripped' as any,
        } as any);
        if (cErr) throw cErr;
        const { error: iErr } = await supabase.from('parts').insert({
          description: `${slotLabel}: ${label}`, brand: component?.brand || null, part_number: component?.mpn || null,
          cost_price: v, quantity: 1, stripped_from_bike_id: bikeId, stock_status: 'in_stock' as any,
          type: 'secondhand_stripped' as any,
        } as any);
        if (iErr) throw iErr;
      }

      const { error: dErr } = await supabase.from('bike_components').delete().eq('bike_id', bikeId).eq('slot', slot);
      if (dErr) throw dErr;

      logActivity(bikeId, {
        kind: 'cost' as any, action: mode === 'stock' ? 'part_removed_to_stock' : 'part_removed',
        summary: mode === 'stock' ? `Returned to stock: ${label} (${slotLabel})` : `Removed from spec: ${label} (${slotLabel})`,
        detail: { slot, part_id: fitted?.id ?? null, value: mode === 'stock' ? v : null },
      });
      toast({ title: mode === 'stock' ? 'Part returned to stock' : 'Part removed' });
      onOpenChange(false);
      onDone();

      if (mode === 'stock' && fitted) {
        const partId = fitted.id;
        void Promise.all([tryPostUnfitPartToQuickBooks(partId), tryPostUnfitPartToXero(partId)]).then(([qb, xe]) => {
          const failed = [!qb.ok && `QuickBooks: ${qb.error}`, !xe.ok && `Xero: ${xe.error}`].filter(Boolean);
          if (failed.length) toast({ title: 'Part returned, but accounts not updated', description: failed.join(' · '), variant: 'destructive' });
        });
      }
    } catch (e: any) {
      toast({ title: 'Could not remove part', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Remove {slotLabel.toLowerCase()}</DialogTitle></DialogHeader>
        {loading ? <div className="text-sm text-muted-foreground">Loading…</div> : (
          <div className="space-y-4">
            <div className="rounded-md border p-3 text-sm">
              <div className="font-medium">{label}</div>
              {fitted && <div className="text-xs text-muted-foreground">Fitted from stock at £{Number(fitted.cost_price || 0).toFixed(2)}</div>}
            </div>
            <RadioGroup value={mode} onValueChange={(m) => setMode(m as any)} className="space-y-2">
              <label className="flex items-start gap-2 cursor-pointer">
                <RadioGroupItem value="stock" className="mt-1" />
                <span className="text-sm"><span className="font-medium">Return to parts stock</span><br />
                  <span className="text-muted-foreground">Takes it off the bike and its value off the bike's costs.</span></span>
              </label>
              <label className="flex items-start gap-2 cursor-pointer">
                <RadioGroupItem value="discard" className="mt-1" />
                <span className="text-sm"><span className="font-medium">Just remove from spec</span><br />
                  <span className="text-muted-foreground">Nothing goes into stock{fitted ? '; its cost stays on the bike' : ''}.</span></span>
              </label>
            </RadioGroup>
            {mode === 'stock' && (
              <div>
                <Label>Stock value (£)</Label>
                <Input type="number" step="0.01" min={0} value={value}
                  onChange={(e) => setValue(e.target.value === '' ? '' : parseFloat(e.target.value))} />
                {fitted && Number(value || 0) < Number(fitted.cost_price || 0) && (
                  <p className="text-xs text-muted-foreground mt-1">The £{(Number(fitted.cost_price || 0) - Number(value || 0)).toFixed(2)} difference stays as a cost on this bike.</p>
                )}
              </div>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving || loading}>{saving ? 'Saving…' : 'Remove'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
