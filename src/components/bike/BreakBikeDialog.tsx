import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logActivity } from '@/lib/activity';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { SPEC_SECTIONS } from '@/lib/bikeSpec';
import { syncShopifyQuietly } from '@/services/shopify';
import { syncSquarespaceQuietly } from '@/services/squarespace';
import { syncEbayQuietly } from '@/services/ebay';
import { fetchBikeComponents } from '../../../supabase/functions/_shared/bike-components';

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

const DRIVETRAIN_SLOTS = ['shifters', 'front_derailleur', 'rear_derailleur', 'cassette', 'chain', 'crank', 'brakes', 'disc_rotors'];
const COCKPIT_SLOTS = ['handlebars', 'stem'];
// Always part of the frame row.
const FRAME_SLOTS = ['frame', 'fork', 'headset', 'bottom_bracket'];
// Optionally part of the frame row.
const FRAME_OPTIONAL_SLOTS = ['seatpost', 'saddle'];
const WHEEL_SLOTS = ['wheelset', 'front_hub', 'rear_hub', 'spokes'];
const TYRE_SLOTS = ['front_tyre', 'rear_tyre'];

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
  const [groupSeatSaddle, setGroupSeatSaddle] = useState(false);
  const [groupWheels, setGroupWheels] = useState(false);

  const load = useCallback(async () => {
    let comps: Awaited<ReturnType<typeof fetchBikeComponents>>;
    let parts: any[] | null, jobs: any[] | null;
    try {
      const [c, p, j] = await Promise.all([
        fetchBikeComponents(supabase, bike.id),
        supabase.from('parts').select('*').eq('bike_id', bike.id),
        supabase.from('jobs').select('actual_cost, estimated_cost').eq('bike_id', bike.id),
      ]);
      // Costs drive the break-even split — a failed read must not look like £0.
      if (p.error) throw new Error(`Could not load parts: ${p.error.message}`);
      if (j.error) throw new Error(`Could not load jobs: ${j.error.message}`);
      comps = c; parts = p.data; jobs = j.data;
    } catch (e) {
      toast({ title: 'Could not load this bike', description: (e as Error).message, variant: 'destructive' });
      return;
    }

    const partsCost = (parts || []).reduce((s, p: any) => s + Number(p.cost_price ?? 0) * Number(p.quantity ?? 1), 0);
    const jobsCost = (jobs || []).reduce((s, j: any) => s + Number(j.actual_cost ?? j.estimated_cost ?? 0), 0);
    const acquisition = Number(bike.purchase_price ?? bike.purchase_cost ?? 0);
    const collection = Number(bike.collection_cost ?? 0);
    const delivery = Number(bike.delivery_cost ?? 0);
    setBikeTotalCost(acquisition + collection + delivery + partsCost + jobsCost);

    const cRows: ComponentRow[] = comps.map((c) => ({
      kind: 'component',
      id: c.id as string,
      slot: c.slot,
      label: slotLabelMap[c.slot] || c.slot,
      brand: c.brand ?? undefined,
      description: [c.brand, c.model].filter(Boolean).join(' ') || c.description || c.slot,
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
    initial['group:wheels'] = { checked: false, value: '' };
    setKeep(initial);
  }, [bike]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const drivetrainComps = useMemo(
    () => compRows.filter((c) => DRIVETRAIN_SLOTS.includes(c.slot)),
    [compRows],
  );
  const cockpitComps = useMemo(
    () => compRows.filter((c) => COCKPIT_SLOTS.includes(c.slot)),
    [compRows],
  );
  const hasDrivetrain = drivetrainComps.length > 0;
  const hasCockpit = cockpitComps.length > 0;
  const frameComps = useMemo(
    () => compRows.filter((c) => FRAME_SLOTS.includes(c.slot) || (groupSeatSaddle && FRAME_OPTIONAL_SLOTS.includes(c.slot))),
    [compRows, groupSeatSaddle],
  );
  const hasSeatSaddle = compRows.some((c) => FRAME_OPTIONAL_SLOTS.includes(c.slot));
  const wheelComps = useMemo(
    () => compRows.filter((c) => WHEEL_SLOTS.includes(c.slot) || TYRE_SLOTS.includes(c.slot)),
    [compRows],
  );
  const hasWheels = wheelComps.length > 0;

  useEffect(() => {
    if (!hasDrivetrain && groupDrivetrain) setGroupDrivetrain(false);
  }, [hasDrivetrain, groupDrivetrain]);
  useEffect(() => {
    if (!hasCockpit && groupCockpit) setGroupCockpit(false);
  }, [hasCockpit, groupCockpit]);

  const mostCommonBrand = (items: { brand?: string | null }[]) => {
    const counts: Record<string, number> = {};
    for (const c of items) {
      const b = c.brand || '';
      if (b) counts[b] = (counts[b] || 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
  };

  const groupsetName = useMemo(() => {
    if (bike?.groupset) return String(bike.groupset);
    return mostCommonBrand(drivetrainComps) || 'Drivetrain';
  }, [bike, drivetrainComps]);

  const cockpitName = useMemo(
    () => mostCommonBrand(cockpitComps) || 'Cockpit',
    [cockpitComps],
  );

  const frameLabel = useMemo(() => {
    const parts = [bike?.make, bike?.model].filter(Boolean).join(' ').trim();
    const size = bike?.frame?.size || bike?.size;
    return `Frame — ${parts || 'Bike frame'}${size ? ` (${size})` : ''}`;
  }, [bike]);
  const frameInventoryDesc = useMemo(() => {
    const parts = [bike?.make, bike?.model].filter(Boolean).join(' ').trim() || 'Frame';
    const size = bike?.frame?.size || bike?.size;
    return `Frame: ${parts}${size ? ` (${size})` : ''}`;
  }, [bike]);

  const rows: Row[] = useMemo(() => {
    const out: Row[] = [];
    // Frame always first — absorbs fork, headset, bottom bracket (and optionally seatpost/saddle)
    const frameSlotLabels = frameComps.map((c) => c.label);
    out.push({
      kind: 'group',
      id: 'frame',
      label: frameLabel,
      description: frameSlotLabels.length ? frameSlotLabels.join(', ') : 'Frame',
      brand: bike?.make || null,
      componentIds: frameComps.map((c) => c.id),
      slotLabels: frameSlotLabels,
    });
    if (groupCockpit && hasCockpit) {
      const slotLabels = cockpitComps.map((c) => c.label);
      out.push({
        kind: 'group',
        id: 'cockpit',
        label: `Cockpit — ${cockpitName}`,
        description: slotLabels.join(', '),
        brand: cockpitComps[0]?.brand || null,
        componentIds: cockpitComps.map((c) => c.id),
        slotLabels,
      });
    }
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
    }
    if (groupWheels && hasWheels) {
      const slotLabels = wheelComps.map((c) => c.label);
      const ws = wheelComps.find((c) => c.slot === 'wheelset');
      out.push({
        kind: 'group',
        id: 'wheels',
        label: `Wheels — ${ws?.description || mostCommonBrand(wheelComps) || 'Wheelset'}`,
        description: slotLabels.join(', '),
        brand: ws?.brand || wheelComps[0]?.brand || null,
        componentIds: wheelComps.map((c) => c.id),
        slotLabels,
      });
    }
    const frameIds = new Set(frameComps.map((c) => c.id));
    for (const c of compRows) {
      const inDrivetrain = groupDrivetrain && DRIVETRAIN_SLOTS.includes(c.slot);
      const inCockpit = groupCockpit && COCKPIT_SLOTS.includes(c.slot);
      const inWheels = groupWheels && (WHEEL_SLOTS.includes(c.slot) || TYRE_SLOTS.includes(c.slot));
      if (!inDrivetrain && !inCockpit && !inWheels && !frameIds.has(c.id)) out.push(c);
    }
    out.push(...partRows);
    return out;
  }, [groupDrivetrain, groupCockpit, groupWheels, hasDrivetrain, hasCockpit, hasWheels, drivetrainComps, cockpitComps, wheelComps, frameComps, compRows, partRows, groupsetName, cockpitName, bike, frameLabel]);

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
          // group rows: frame / cockpit / drivetrain
          const isFrame = r.id === 'frame';
          const isCockpit = r.id === 'cockpit';
          const isWheels = r.id === 'wheels';
          const slotList = r.slotLabels.join(', ');
          const inventoryDesc = isFrame
            ? `${frameInventoryDesc}${slotList ? ` (${slotList})` : ''}`
            : isWheels
              ? `${r.label.replace(' — ', ': ')}${slotList ? ` (${slotList})` : ''}`
            : isCockpit
              ? `Cockpit: ${cockpitName}${slotList ? ` (${slotList})` : ''}`
              : `Drivetrain: ${groupsetName}${slotList ? ` (${slotList})` : ''}`;
          const creditDesc = `Stripped: ${r.label}${slotList ? ` (${slotList})` : ''}`;
          const { error: creditErr } = await supabase.from('parts').insert({
            bike_id: bike.id,
            description: creditDesc,
            brand: r.brand || null,
            cost_price: -Math.abs(value),
            quantity: 1,
            stock_status: 'sold' as any,
            type: 'secondhand_stripped' as any,
          } as any);
          if (creditErr) throw creditErr;
          const { error: insErr } = await supabase.from('parts').insert({
            description: inventoryDesc,
            brand: r.brand || null,
            cost_price: value,
            quantity: 1,
            stripped_from_bike_id: bike.id,
            stock_status: 'in_stock' as any,
            type: 'secondhand_stripped' as any,
          } as any);
          if (insErr) throw insErr;
          if (r.componentIds.length > 0) {
            const { error: delErr } = await supabase
              .from('bike_components')
              .delete()
              .in('id', r.componentIds);
            if (delErr) throw delErr;
          }
        }
      }
      const { error: bikeErr } = await supabase
        .from('bikes')
        .update({ status: 'split_for_parts' as any })
        .eq('id', bike.id);
      if (bikeErr) throw bikeErr;
      void syncShopifyQuietly(bike.id, 'sold_out');
      void syncSquarespaceQuietly(bike.id, 'sold_out');
      void syncEbayQuietly(bike.id, 'end');
      logActivity(bike.id, {
        kind: 'status_change',
        action: 'split_for_parts',
        summary: 'Bike split for parts',
        detail: {},
      });
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

          <div className="flex flex-col gap-2">
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
            <div className="flex items-center gap-2">
              <Checkbox
                id="group-cockpit"
                checked={groupCockpit}
                disabled={!hasCockpit}
                onCheckedChange={(c) => setGroupCockpit(!!c)}
              />
              <Label htmlFor="group-cockpit" className={!hasCockpit ? 'text-muted-foreground' : ''}>
                Group bar & stem as a single row
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="group-seat"
                checked={groupSeatSaddle}
                disabled={!hasSeatSaddle}
                onCheckedChange={(c) => setGroupSeatSaddle(!!c)}
              />
              <Label htmlFor="group-seat" className={!hasSeatSaddle ? 'text-muted-foreground' : ''}>
                Include seatpost & saddle with frame
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="group-wheels"
                checked={groupWheels}
                disabled={!hasWheels}
                onCheckedChange={(c) => setGroupWheels(!!c)}
              />
              <Label htmlFor="group-wheels" className={!hasWheels ? 'text-muted-foreground' : ''}>
                Group wheels & tyres as a single row
              </Label>
            </div>
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
