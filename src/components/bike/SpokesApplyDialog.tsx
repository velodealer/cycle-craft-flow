import { useMemo, useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { setAtPath } from '@/lib/bikeSpec';
import SpokesLookup from '@/components/management/SpokesLookup';
import {
  buildReviewRows,
  saveCatalogBike,
  spokesCatalogColumns,
  upsertComponentsForBike,
  describeLinkResult,
  type LinkResult,
  type MappedBike,
  type MappedComponent,
  type ReviewRow,
} from '@/lib/spokes';

interface Props {
  bike: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApplied: () => void;
}

function display(v: any) {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  return String(v);
}

const slotName = (slot: string) => slot.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
const componentValue = (part: MappedComponent) => [part.brand, part.model, part.mpn].filter(Boolean).join(' · ');
const componentDetails = (part: MappedComponent) => [
  part.description,
  ...Object.entries(part.attributes || {}).map(([key, value]) =>
    `${slotName(key)}: ${typeof value === 'object' ? JSON.stringify(value) : String(value)}`),
].filter(Boolean);

export default function SpokesApplyDialog({ bike, open, onOpenChange, onApplied }: Props) {
  const [payload, setPayload] = useState<{ raw: any; mapped: MappedBike; size: string | null } | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [selectedParts, setSelectedParts] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  const rows: ReviewRow[] = useMemo(
    () => (payload ? buildReviewRows(payload.mapped, bike) : []),
    [payload, bike],
  );

  const reset = () => {
    setPayload(null);
    setSelected({});
    setSelectedParts({});
  };

  const handleSelect = async (p: { raw: any; mapped: MappedBike; size: string | null }) => {
    setPayload(p);
    const next: Record<string, boolean> = {};
    // Blank fields are ticked by default; anything already filled in is left alone.
    buildReviewRows(p.mapped, bike).forEach((r) => {
      next[r.key] = r.current === null || r.current === undefined || r.current === '';
    });
    setSelected(next);
    const { data, error } = await supabase.from('bike_components').select('slot').eq('bike_id', bike.id);
    if (error) {
      toast({ title: 'Could not check fitted parts', description: error.message, variant: 'destructive' });
    }
    const fitted = new Set((data || []).map((row) => row.slot));
    setSelectedParts(Object.fromEntries(p.mapped.components.map((part) => [part.slot, !fitted.has(part.slot)])));
  };

  const toggleAll = (value: boolean) => {
    const next: Record<string, boolean> = {};
    rows.forEach((r) => { next[r.key] = value; });
    setSelected(next);
  };

  const apply = async () => {
    if (!payload) return;
    setSaving(true);
    try {
      const updates: Record<string, any> = {};
      let spec = { ...(bike.spec_values || {}) };

      rows.forEach((r) => {
        if (!selected[r.key]) return;
        const [kind, path] = [r.key.slice(0, r.key.indexOf(':')), r.key.slice(r.key.indexOf(':') + 1)];
        if (kind === 'bike') updates[path] = r.incoming;
        else spec = setAtPath(spec, path, r.incoming);
      });
      updates.spec_values = spec;
      // Keep the complete source record with the bike, whatever was ticked.
      Object.assign(updates, spokesCatalogColumns(payload.raw, payload.size));

      const { error } = await supabase.from('bikes').update(updates as any).eq('id', bike.id);
      if (error) throw error;

      await saveCatalogBike(payload.raw, payload.mapped);

      const partsToLink = payload.mapped.components.filter((part) => selectedParts[part.slot]);
      const link: LinkResult | null = partsToLink.length
        ? await upsertComponentsForBike(bike.id, partsToLink)
        : null;

      toast({
        title: link?.failed.length ? 'Specification applied — some parts failed' : 'Specification applied',
        description: link ? describeLinkResult(link) : undefined,
        variant: link?.failed.length ? 'destructive' : undefined,
      });
      reset();
      onOpenChange(false);
      onApplied();
    } catch (e: any) {
      toast({ title: 'Could not apply specification', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const selectedCount = rows.filter((r) => selected[r.key]).length;
  const selectedPartCount = payload?.mapped.components.filter((part) => selectedParts[part.slot]).length ?? 0;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" /> Fill specification from 99spokes
          </DialogTitle>
          <DialogDescription>
            Search for the matching bike, then choose which values to apply. Fields that are already filled in stay
            unticked by default.
          </DialogDescription>
        </DialogHeader>

        <SpokesLookup
          onSelect={handleSelect}
          confirmLabel="Review changes"
          initialQuery={[bike?.make, bike?.model].filter(Boolean).join(' ')}
        />

        {payload && (
          <>
            <Separator />
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">{selectedCount} of {rows.length} values selected</p>
              <div className="flex gap-1">
                <Button type="button" variant="ghost" size="sm" onClick={() => toggleAll(true)}>Select all</Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => toggleAll(false)}>Clear</Button>
              </div>
            </div>

            <ScrollArea className="h-[240px] rounded-md border">
              <div className="divide-y">
                {rows.map((r) => (
                  <label key={r.key} className="flex items-start gap-3 p-2 cursor-pointer hover:bg-muted/50">
                    <Checkbox
                      checked={!!selected[r.key]}
                      onCheckedChange={(v) => setSelected((s) => ({ ...s, [r.key]: !!v }))}
                      className="mt-1"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">{r.label}</div>
                      <div className="text-xs text-muted-foreground break-words">
                        {display(r.current)} <span className="mx-1">→</span>
                        <span className="text-foreground">{display(r.incoming)}</span>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </ScrollArea>

            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">{selectedPartCount} of {payload.mapped.components.length} parts selected</p>
              <div className="flex gap-1">
                <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedParts(Object.fromEntries(payload.mapped.components.map((part) => [part.slot, true])))}>Select all</Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedParts({})}>Clear</Button>
              </div>
            </div>
            <ScrollArea className="h-[280px] rounded-md border">
              <div className="divide-y">
                {payload.mapped.components.length === 0 ? (
                  <p className="p-3 text-sm text-muted-foreground">No component details were supplied by 99Spokes.</p>
                ) : payload.mapped.components.map((part) => (
                  <label key={part.slot} className="flex cursor-pointer items-start gap-3 p-3 hover:bg-muted/50">
                    <Checkbox
                      checked={!!selectedParts[part.slot]}
                      onCheckedChange={(value) => setSelectedParts((current) => ({ ...current, [part.slot]: !!value }))}
                      className="mt-1"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">{slotName(part.slot)}</div>
                      <div className="text-sm break-words">{componentValue(part)}</div>
                      {componentDetails(part).map((detail, index) => (
                        <div key={`${part.slot}-${index}`} className="text-xs text-muted-foreground break-words">{detail}</div>
                      ))}
                    </div>
                  </label>
                ))}
              </div>
            </ScrollArea>
          </>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" onClick={apply} disabled={!payload || saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
