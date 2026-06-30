import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import ComponentPicker from '@/components/components/ComponentPicker';
import StripComponentDialog from './StripComponentDialog';
import { PackageMinus } from 'lucide-react';
import {
  BIKE_TYPES, FRAME_MATERIALS, GENDERS, CONDITIONS,
  SPEC_SECTIONS, applyTypeDefaults, getAtPath, setAtPath,
  type FieldDef, type SlotDef,
} from '@/lib/bikeSpec';

interface Props {
  bike: any;
  onUpdate: () => void;
}

export default function BikeSpecificationSection({ bike, onUpdate }: Props) {
  const [draft, setDraft] = useState<any>(bike);
  const [savingGeneral, setSavingGeneral] = useState(false);
  const [savingSection, setSavingSection] = useState<string | null>(null);
  const [bikeComponents, setBikeComponents] = useState<Record<string, string>>({}); // slot -> component_id
  const [stripping, setStripping] = useState<{ slot: string; label: string; componentId: string } | null>(null);

  const reloadComponents = () => {
    if (!bike?.id) return;
    supabase.from('bike_components').select('slot, component_id').eq('bike_id', bike.id)
      .then(({ data }) => {
        const map: Record<string, string> = {};
        (data || []).forEach((r: any) => { map[r.slot] = r.component_id; });
        setBikeComponents(map);
      });
  };

  useEffect(() => { setDraft(bike); }, [bike]);

  useEffect(() => {
    if (!bike?.id) return;
    supabase.from('bike_components').select('slot, component_id').eq('bike_id', bike.id)
      .then(({ data }) => {
        const map: Record<string, string> = {};
        (data || []).forEach((r: any) => { map[r.slot] = r.component_id; });
        setBikeComponents(map);
      });
  }, [bike?.id]);

  const visibleSections = useMemo(() => SPEC_SECTIONS.filter((s) => !s.show || s.show(draft)), [draft]);

  const updateDraft = (patch: any) => setDraft((d: any) => ({ ...d, ...patch }));
  const updateSpec = (path: string, value: any) =>
    setDraft((d: any) => ({ ...d, spec_values: setAtPath(d.spec_values || {}, path, value) }));

  const saveGeneral = async () => {
    setSavingGeneral(true);
    const payload = {
      bike_type: draft.bike_type || null,
      gender: draft.gender || null,
      weight_kg: draft.weight_kg ?? null,
      frame_material: draft.frame_material || null,
      serial_number: draft.serial_number || null,
      barcode: draft.barcode || null,
      sku: draft.sku || null,
      size: draft.size || null,
      colour: draft.colour || null,
      condition: draft.condition || null,
      description: draft.description || null,
      has_rear_shock: !!draft.has_rear_shock,
      has_suspension_fork: !!draft.has_suspension_fork,
      has_dropper: !!draft.has_dropper,
      is_electric: !!draft.is_electric,
      has_accessories: !!draft.has_accessories,
    };
    const { error } = await supabase.from('bikes').update(payload).eq('id', bike.id);
    setSavingGeneral(false);
    if (error) { toast({ title: 'Save failed', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'General specification saved' });
    onUpdate();
  };

  const saveSection = async (sectionId: string) => {
    setSavingSection(sectionId);
    const { error } = await supabase
      .from('bikes')
      .update({ spec_values: draft.spec_values || {} })
      .eq('id', bike.id);
    setSavingSection(null);
    if (error) { toast({ title: 'Save failed', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Specification saved' });
    onUpdate();
  };

  const onSlotChange = async (slot: SlotDef, componentId: string | null) => {
    if (!bike?.id) return;
    if (!componentId) {
      await supabase.from('bike_components').delete().eq('bike_id', bike.id).eq('slot', slot.slot);
      setBikeComponents((m) => { const n = { ...m }; delete n[slot.slot]; return n; });
      return;
    }
    const { error } = await supabase
      .from('bike_components')
      .upsert({ bike_id: bike.id, slot: slot.slot, component_id: componentId, position: slot.position || null }, { onConflict: 'bike_id,slot' });
    if (error) { toast({ title: 'Could not link component', description: error.message, variant: 'destructive' }); return; }
    setBikeComponents((m) => ({ ...m, [slot.slot]: componentId }));
  };

  const renderField = (sectionPath: string, f: FieldDef) => {
    const path = sectionPath ? `${sectionPath}.${f.key}` : f.key;
    const val = getAtPath(draft.spec_values, path);
    if (f.type === 'checkbox') {
      return (
        <div className="flex items-center gap-2 pt-6">
          <Checkbox id={path} checked={!!val} onCheckedChange={(c) => updateSpec(path, !!c)} />
          <Label htmlFor={path} className="cursor-pointer">{f.label}</Label>
        </div>
      );
    }
    if (f.type === 'textarea') {
      return (
        <div className="col-span-2">
          <Label>{f.label}</Label>
          <Textarea value={val ?? ''} onChange={(e) => updateSpec(path, e.target.value)} rows={3} />
        </div>
      );
    }
    if (f.type === 'select') {
      return (
        <div>
          <Label>{f.label}</Label>
          <Select value={val ?? ''} onValueChange={(v) => updateSpec(path, v)}>
            <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
            <SelectContent>
              {(f.options || []).map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      );
    }
    return (
      <div>
        <Label>{f.label}</Label>
        <Input
          type={f.type === 'number' ? 'number' : 'text'}
          placeholder={f.placeholder}
          value={val ?? ''}
          onChange={(e) => updateSpec(path, f.type === 'number' ? (e.target.value ? Number(e.target.value) : null) : e.target.value)}
        />
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Specification</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* General */}
        <div className="rounded-md border p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label>Bike type</Label>
              <Select
                value={draft.bike_type || ''}
                onValueChange={(v) => updateDraft({ bike_type: v, ...applyTypeDefaults(v) })}
              >
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  {BIKE_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Frame material</Label>
              <Select value={draft.frame_material || ''} onValueChange={(v) => updateDraft({ frame_material: v })}>
                <SelectTrigger><SelectValue placeholder="Select material" /></SelectTrigger>
                <SelectContent>
                  {FRAME_MATERIALS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Gender</Label>
              <Select value={draft.gender || ''} onValueChange={(v) => updateDraft({ gender: v })}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {GENDERS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Condition</Label>
              <Select value={draft.condition || ''} onValueChange={(v) => updateDraft({ condition: v })}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {CONDITIONS.map((c) => <SelectItem key={c} value={c}>{c.replace('_', ' ')}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Size</Label>
              <Input value={draft.size || ''} onChange={(e) => updateDraft({ size: e.target.value })} />
            </div>
            <div>
              <Label>Colour</Label>
              <Input value={draft.colour || ''} onChange={(e) => updateDraft({ colour: e.target.value })} />
            </div>
            <div>
              <Label>Weight (kg)</Label>
              <Input type="number" step="0.01" value={draft.weight_kg ?? ''}
                     onChange={(e) => updateDraft({ weight_kg: e.target.value ? Number(e.target.value) : null })} />
            </div>
            <div>
              <Label>Serial number</Label>
              <Input value={draft.serial_number || ''} onChange={(e) => updateDraft({ serial_number: e.target.value })} />
            </div>
            <div>
              <Label>Barcode</Label>
              <Input value={draft.barcode || ''} onChange={(e) => updateDraft({ barcode: e.target.value })} />
            </div>
            <div>
              <Label>SKU</Label>
              <Input value={draft.sku || ''} onChange={(e) => updateDraft({ sku: e.target.value })} />
            </div>
            <div className="md:col-span-3">
              <Label>Description</Label>
              <Textarea rows={2} value={draft.description || ''} onChange={(e) => updateDraft({ description: e.target.value })} />
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-2 border-t">
            <ToggleRow label="Suspension fork" checked={!!draft.has_suspension_fork}
              onChange={(v) => updateDraft({ has_suspension_fork: v })} />
            <ToggleRow label="Rear shock" checked={!!draft.has_rear_shock}
              onChange={(v) => updateDraft({ has_rear_shock: v })} />
            <ToggleRow label="Dropper post" checked={!!draft.has_dropper}
              onChange={(v) => updateDraft({ has_dropper: v })} />
            <ToggleRow label="Electric" checked={!!draft.is_electric}
              onChange={(v) => updateDraft({ is_electric: v })} />
            <ToggleRow label="Accessories" checked={!!draft.has_accessories}
              onChange={(v) => updateDraft({ has_accessories: v })} />
          </div>

          <div className="flex justify-end">
            <Button onClick={saveGeneral} disabled={savingGeneral}>
              {savingGeneral ? 'Saving…' : 'Save general'}
            </Button>
          </div>
        </div>

        {/* Per-section accordion */}
        <Accordion type="multiple" className="w-full">
          {visibleSections.map((s) => (
            <AccordionItem value={s.id} key={s.id}>
              <AccordionTrigger>{s.title}</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4">
                  {s.slots && s.slots.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {s.slots.map((slot) => {
                        const linkedId = bikeComponents[slot.slot] || null;
                        return (
                          <div key={slot.slot}>
                            <Label>{slot.label}</Label>
                            <div className="flex gap-1 items-start">
                              <div className="flex-1">
                                <ComponentPicker
                                  categorySlug={slot.categorySlug}
                                  value={linkedId}
                                  onChange={(id) => onSlotChange(slot, id)}
                                />
                              </div>
                              {linkedId && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  title="Strip to inventory"
                                  onClick={() => setStripping({ slot: slot.slot, label: slot.label, componentId: linkedId })}
                                >
                                  <PackageMinus className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {s.fields && s.fields.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {s.fields.map((f) => <div key={f.key}>{renderField(s.path, f)}</div>)}
                    </div>
                  )}
                  <div className="flex justify-end">
                    <Button onClick={() => saveSection(s.id)} disabled={savingSection === s.id}>
                      {savingSection === s.id ? 'Saving…' : `Save ${s.title.toLowerCase()}`}
                    </Button>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  );
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <Label className="cursor-pointer">{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
