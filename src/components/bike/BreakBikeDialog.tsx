import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { SPEC_SECTIONS } from '@/lib/bikeSpec';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  bike: any;
  onDone: () => void;
}

type ComponentRow = {
  kind: 'component';
  id: string;
  slot: string;
  label: string;
  description: string;
  brand?: string | null;
};
type PartRow = {
  kind: 'part';
  id: string;
  description: string;
  brand?: string | null;
  currentCost: number;
};
type GroupRow = {
  kind: 'group';
  id: string; // synthetic, e.g. 'drivetrain'
  label: string;
  description: string;
  brand?: string | null;
  componentIds: string[];
  slotLabels: string[];
};
type Row = ComponentRow | PartRow | GroupRow;

const DRIVETRAIN_SLOTS = ['shifters', 'front_derailleur', 'rear_derailleur', 'cassette', 'chain', 'crank', 'brakes'];
const COCKPIT_SLOTS = ['handlebars', 'stem'];

const slotLabelMap: Record<string, string> = (() => {
  const m: Record<string, string> = {};
  for (const s of SPEC_SECTIONS) for (const slot of s.slots || []) m[slot.slot] = slot.label;
  return m;
})();

const fmt = (n: number) => `£${n.toFixed(2)}`;

export default function BreakBikeDialog({ open, onOpenChange, bike, onDone }: Props) {
  const { toast } = useToast();
  const [compRows, setCompRows] = useState<ComponentRow[]>([]);
  const [partRows, setPartRows] = useState<PartRow[]>([]);
  const [keep, setKeep] = useState<Record<string, { checked: boolean; value: number | '' }>>({});
  const [bikeTotalCost, setBikeTotalCost] = useState(0);
  const [saving, setSaving] = useState(false);
  const [groupDrivetrain, setGroupDrivetrain] = useState(false);
  const [groupCockpit, setGroupCockpit] = useState(false);

  const load = useCallback(async () => {
    const [{ data: comps }, { data: parts }, { data: jobs }] = await Promise.all([
      supabase.from('bike_components').select('id, slot, notes, component:components(id, brand, model, description)').eq('bike_id', bike.id),
      supabase.from('parts').select('*').eq('bike_id', bike.id),
      supabase.from('jobs').select('actual_cost, estimated_cost').eq('bike_id', bike.id),
    ]);

    const partsCost = (parts || []).reduce((s, p: any) => s + Number(p.cost_price ?? 0) * Number(p.quantity ?? 1), 0);
    const jobsCost = (jobs || []).reduce((s, j: any) => s + Number(j.actual_cost ?? j.estimated_cost ?? 0), 0);
    const acquisition = Number(bike.purchase_price ?? bike.purchase_cost ?? 0);
    const collection = Number(bike.collection_cost ?? 0);
    const delivery = Number(bike.delivery_cost ?? 0);
    setBikeTotalCost(acquisition + collection + delivery + partsCost + jobsCost);

    const cRows: ComponentRow[] = (comps || []).map((c: any) => ({
      kind: 'component',
      id: c.id,
      slot: c.slot,
      label: slotLabelMap[c.slot] || c.slot,
      brand: c.component?.brand,
      description: [c.component?.brand, c.component?.model].filter(Boolean).join(' ') || c.component?.description || c.slot,
    }));
    const pRows: PartRow[] = (parts || []).map((p: any) => ({
      kind: 'part',
      id: p.id,
      description: p.description,
      brand: p.brand,
      currentCost: Number(p.cost_price ?? 0),
    }));
    setCompRows(cRows);
    setPartRows(pRows);

    const initial: Record<string, { checked: boolean; value: number | '' }> = {};
    for (const r of cRows) initial[`component:${r.id}`] = { checked: false, value: '' };
    for (const r of pRows) initial[`part:${r.id}`] = { checked: false, value: r.currentCost };
    initial['group:drivetrain'] = { checked: false, value: '' };
    initial['group:cockpit'] = { checked: false, value: '' };
    initial['group:frame'] = { checked: false, value: '' };
    setKeep(initial);
  }, [bike]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const drivetrainComps = useMemo(
    () => compRows.filter((c) => DRIVETRAIN_SLOTS.includes(c.slot)),
    [compRows],
  );
  const hasDrivetrain = drivetrainComps.length > 0;

  // Force-off grouping when no drivetrain components exist
  useEffect(() => {
    if (!hasDrivetrain && groupDrivetrain) setGroupDrivetrain(false);
  }, [hasDrivetrain, groupDrivetrain]);

  const groupsetName = useMemo(() => {
    if (bike?.groupset) return String(bike.groupset);
    // most common brand among drivetrain components
    const counts: Record<string, number> = {};
    for (const c of drivetrainComps) {
      const b = c.brand || '';
      if (b) counts[b] = (counts[b] || 0) + 1;
    }
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
    return top || 'Drivetrain';
  }, [bike, drivetrainComps]);

  const rows: Row[] = useMemo(() => {
    const out: Row[] = [];
    if (groupDrivetrain && hasDrivetrain) {
      const slotLabels = drivetrainComps.map((c) => c.label);
      out.push({
        kind: 'group',
        id: 'drivetrain',
        label: `Drivetrain — ${groupsetName}`,
        description: slotLabels.join(', '),
        brand: bike?.groupset_brand || drivetrainComps[0]?.brand || null,
        componentIds: drivetrainComps.map((c) => c.id),
        slotLabels,
      });
      for (const c of compRows) if (!DRIVETRAIN_SLOTS.includes(c.slot)) out.push(c);
    } else {
      out.push(...compRows);
    }
    out.push(...partRows);
    return out;
  }, [groupDrivetrain, hasDrivetrain, drivetrainComps, compRows, partRows, groupsetName, bike]);

  const total = useMemo(
    () => rows.reduce((s, r) => {
      const k = keep[`${r.kind}:${r.id}`];
      return s + (k?.checked && k.value !== '' ? Number(k.value) : 0);
    }, 0),
    [keep, rows],
  );
  const headroom = bikeTotalCost - total;
  const overspent = total > bikeTotalCost;

  const toggle = (key: string, checked: boolean) =>
    setKeep((k) => ({ ...k, [key]: { ...(k[key] || { value: '' }), checked } }));
  const setVal = (key: string, value: number | '') =>
    setKeep((k) => ({ ...k, [key]: { ...(k[key] || { checked: false }), value } }));

  const save = async () => {
    if (overspent) return toast({ title: 'Total exceeds bike cost', variant: 'destructive' });
    const selected = rows.filter((r) => keep[`${r.kind}:${r.id}`]?.checked);
    if (selected.some((r) => {
      const k = keep[`${r.kind}:${r.id}`];
      return k.value === '' || Number(k.value) < 0;
    })) {
      return toast({ title: 'Set a value for every kept part', variant: 'destructive' });
    }
    setSaving(true);
    try {
      for (const r of selected) {
        const value = Number(keep[`${r.kind}:${r.id}`].value);
        if (r.kind === 'part') {
          const { error } = await supabase
            .from('parts')
            .update({
              bike_id: null,
              stripped_from_bike_id: bike.id,
              stock_status: 'in_stock' as any,
              type: 'secondhand_stripped' as any,
              cost_price: value,
              quantity: 1,
            } as any)
            .eq('id', r.id);
          if (error) throw error;
        } else if (r.kind === 'component') {
          const { error: creditErr } = await supabase.from('parts').insert({
            bike_id: bike.id,
            description: `Stripped: ${r.label} — ${r.description}`,
            brand: r.brand || null,
            cost_price: -Math.abs(value),
            quantity: 1,
            stock_status: 'sold' as any,
            type: 'secondhand_stripped' as any,
          } as any);
          if (creditErr) throw creditErr;
          const { error: insErr } = await supabase.from('parts').insert({
            description: `${r.label}: ${r.description}`,
            brand: r.brand || null,
            cost_price: value,
            quantity: 1,
            stripped_from_bike_id: bike.id,
            stock_status: 'in_stock' as any,
            type: 'secondhand_stripped' as any,
          } as any);
          if (insErr) throw insErr;
          const { error: delErr } = await supabase.from('bike_components').delete().eq('id', r.id);
          if (delErr) throw delErr;
        } else {
          // group: drivetrain
          const slotList = r.slotLabels.join(', ');
          const { error: creditErr } = await supabase.from('parts').insert({
            bike_id: bike.id,
            description: `Stripped: ${r.label} (${slotList})`,
            brand: r.brand || null,
            cost_price: -Math.abs(value),
            quantity: 1,
            stock_status: 'sold' as any,
            type: 'secondhand_stripped' as any,
          } as any);
          if (creditErr) throw creditErr;
          const { error: insErr } = await supabase.from('parts').insert({
            description: `Drivetrain: ${groupsetName} (${slotList})`,
            brand: r.brand || null,
            cost_price: value,
            quantity: 1,
            stripped_from_bike_id: bike.id,
            stock_status: 'in_stock' as any,
            type: 'secondhand_stripped' as any,
          } as any);
          if (insErr) throw insErr;
          const { error: delErr } = await supabase
            .from('bike_components')
            .delete()
            .in('id', r.componentIds);
          if (delErr) throw delErr;
        }
      }
      const { error: bikeErr } = await supabase
        .from('bikes')
        .update({ status: 'split_for_parts' as any })
        .eq('id', bike.id);
      if (bikeErr) throw bikeErr;
      toast({ title: 'Bike broken for parts' });
      onOpenChange(false);
      onDone();
    } catch (e: any) {
      toast({ title: 'Failed to break bike', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Break bike for parts</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Tick the components you want to keep and assign each a stock value. Kept parts move into inventory.
            The bike's status changes to <span className="font-medium">Split for parts</span>.
          </p>

          <div className="flex items-center gap-2">
            <Checkbox
              id="group-drivetrain"
              checked={groupDrivetrain}
              disabled={!hasDrivetrain}
              onCheckedChange={(c) => setGroupDrivetrain(!!c)}
            />
            <Label htmlFor="group-drivetrain" className={!hasDrivetrain ? 'text-muted-foreground' : ''}>
              Group drivetrain as a single row
            </Label>
          </div>

          <div className="border rounded-md">
            <div className="grid grid-cols-[auto_1fr_140px] gap-3 px-3 py-2 text-xs font-semibold text-muted-foreground border-b">
              <span>Keep</span>
              <span>Part</span>
              <span className="text-right">Value (£)</span>
            </div>
            {rows.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">No components or parts attached to this bike.</p>
            ) : (
              rows.map((r) => {
                const key = `${r.kind}:${r.id}`;
                const state = keep[key];
                const primary =
                  r.kind === 'component' ? `${r.label}: ${r.description}`
                  : r.kind === 'group' ? r.label
                  : r.description;
                const secondary =
                  r.kind === 'component' ? 'Component (slot)'
                  : r.kind === 'group' ? `Includes: ${r.description}`
                  : `Part${r.brand ? ` • ${r.brand}` : ''}`;
                return (
                  <div key={key} className="grid grid-cols-[auto_1fr_140px] gap-3 px-3 py-2 items-center border-b last:border-b-0">
                    <Checkbox checked={!!state?.checked} onCheckedChange={(c) => toggle(key, !!c)} />
                    <div>
                      <div className="text-sm font-medium">{primary}</div>
                      <div className="text-xs text-muted-foreground">{secondary}</div>
                    </div>
                    <Input
                      type="number"
                      step="0.01"
                      min={0}
                      disabled={!state?.checked}
                      value={state?.value ?? ''}
                      onChange={(e) => setVal(key, e.target.value === '' ? '' : parseFloat(e.target.value))}
                      className="text-right"
                    />
                  </div>
                );
              })
            )}
          </div>

          <div className="rounded-md border bg-muted/30 p-3 space-y-1 text-sm">
            <div className="flex justify-between"><span>Bike total cost</span><span>{fmt(bikeTotalCost)}</span></div>
            <div className="flex justify-between"><span>Total kept value</span><span>{fmt(total)}</span></div>
            <div className={`flex justify-between font-medium ${overspent ? 'text-destructive' : ''}`}>
              <span>Remaining headroom</span><span>{fmt(headroom)}</span>
            </div>
            {overspent && (
              <p className="text-xs text-destructive">Total kept value cannot exceed the bike's total cost.</p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving || overspent}>{saving ? 'Saving…' : 'Break bike'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
