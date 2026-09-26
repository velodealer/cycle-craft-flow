import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { Plus, Trash2 } from 'lucide-react';
import type { Json } from '@/integrations/supabase/types';


export interface ComponentCategory {
  id: string;
  slug: string;
  name: string;
}

export interface ComponentRecord {
  id: string;
  category_id: string;
  brand: string;
  model: string;
  mpn: string | null;
  description: string | null;
  weight_g: number | null;
  /** Extra manufacturer details pulled from the catalogue. */
  attributes?: Json;
}

interface AttributeRow {
  id: number;
  name: string;
  value: string;
  originalValue?: Json;
}

let nextAttributeId = 0;

const makeAttributeRows = (attributes?: Json): AttributeRow[] =>
  Object.entries(attributes && typeof attributes === 'object' && !Array.isArray(attributes) ? attributes : {}).map(([name, value]) => ({
    id: nextAttributeId++,
    name,
    value: typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value ?? ''),
    originalValue: value,
  }));

const parseAttributeValue = (row: AttributeRow): Json => {
  const value = row.value.trim();
  const originalDisplay = typeof row.originalValue === 'object' && row.originalValue !== null
    ? JSON.stringify(row.originalValue)
    : String(row.originalValue ?? '');
  if (value === originalDisplay) return row.originalValue ?? '';
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (/^-?(?:\d+\.?\d*|\.\d+)$/.test(value)) return Number(value);
  if ((value.startsWith('[') && value.endsWith(']')) || (value.startsWith('{') && value.endsWith('}'))) {
    try {
      return JSON.parse(value) as Json;
    } catch {
      return value;
    }
  }
  return value;
};


interface Props {
  component?: ComponentRecord | null;
  defaultCategorySlug?: string;
  onSaved: (c: ComponentRecord) => void;
  onCancel: () => void;
}

export default function ComponentForm({ component, defaultCategorySlug, onSaved, onCancel }: Props) {
  const [categories, setCategories] = useState<ComponentCategory[]>([]);
  const [categoryId, setCategoryId] = useState(component?.category_id || '');
  const [brand, setBrand] = useState(component?.brand || '');
  const [model, setModel] = useState(component?.model || '');
  const [mpn, setMpn] = useState(component?.mpn || '');
  const [description, setDescription] = useState(component?.description || '');
  const [weight, setWeight] = useState<string>(component?.weight_g?.toString() || '');
  const [attributeRows, setAttributeRows] = useState<AttributeRow[]>(() => makeAttributeRows(component?.attributes));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from('component_categories').select('id, slug, name').order('sort_order').then(({ data }) => {
      const cats = (data || []) as ComponentCategory[];
      setCategories(cats);
      if (!categoryId) {
        const def = defaultCategorySlug ? cats.find((c) => c.slug === defaultCategorySlug) : null;
        if (def) setCategoryId(def.id);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async () => {
    if (!categoryId || !brand.trim() || !model.trim()) {
      toast({ title: 'Category, brand and model are required', variant: 'destructive' });
      return;
    }
    if (weight.trim() && (!Number.isFinite(Number(weight)) || Number(weight) < 0)) {
      toast({ title: 'Weight must be a valid positive number', variant: 'destructive' });
      return;
    }
    const populatedRows = attributeRows.filter((row) => row.name.trim() || row.value.trim());
    const missingName = populatedRows.some((row) => !row.name.trim());
    if (missingName) {
      toast({ title: 'Every manufacturer detail needs a name', variant: 'destructive' });
      return;
    }
    const normalisedNames = populatedRows.map((row) => row.name.trim().toLowerCase());
    if (new Set(normalisedNames).size !== normalisedNames.length) {
      toast({ title: 'Manufacturer detail names must be unique', variant: 'destructive' });
      return;
    }
    const attributes: { [key: string]: Json } = Object.fromEntries(
      populatedRows.map((row) => [row.name.trim(), parseAttributeValue(row)]),
    );
    setSaving(true);
    const payload = {
      category_id: categoryId,
      brand: brand.trim(),
      model: model.trim(),
      mpn: mpn.trim() || null,
      description: description.trim() || null,
      weight_g: weight ? Number(weight) : null,
      attributes,
    };
    const q = component
      ? supabase.from('components').update(payload).eq('id', component.id).select('*').single()
      : supabase.from('components').insert(payload).select('*').single();
    const { data, error } = await q;
    setSaving(false);
    if (error) {
      toast({ title: 'Could not save component', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: component ? 'Component updated' : 'Component created' });
    onSaved(data as ComponentRecord);
  };

  const updateAttribute = (id: number, field: 'name' | 'value', value: string) => {
    setAttributeRows((rows) => rows.map((row) => row.id === id ? { ...row, [field]: value } : row));
  };

  return (
    <div className="flex max-h-[calc(90dvh-5rem)] min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
       <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label>Category *</Label>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
            <SelectContent>
              {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Brand *</Label>
          <Input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Shimano" />
        </div>
        <div>
          <Label>Model *</Label>
          <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder="Ultegra R8170" />
        </div>
        <div>
          <Label>Manufacturer Part Number</Label>
          <Input value={mpn} onChange={(e) => setMpn(e.target.value)} placeholder="RD-R8170" />
        </div>
        <div>
          <Label>Weight (g)</Label>
          <Input type="number" value={weight} onChange={(e) => setWeight(e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <Label>Description</Label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
        </div>
        <div className="space-y-3 border-t pt-4 sm:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <Label>Manufacturer details</Label>
              <p className="text-xs text-muted-foreground">Add every supplied specification for this component.</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setAttributeRows((rows) => [...rows, { id: nextAttributeId++, name: '', value: '' }])}
            >
              <Plus className="mr-1 h-4 w-4" /> Add detail
            </Button>
          </div>
          {attributeRows.length === 0 ? (
            <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">No manufacturer details added yet.</p>
          ) : (
            <div className="space-y-2">
              {attributeRows.map((row, index) => (
                <div key={row.id} className="grid grid-cols-[minmax(0,1fr)_2.5rem] gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_2.5rem]">
                  <div className="sm:col-auto">
                    <Label htmlFor={`attribute-name-${row.id}`} className="sr-only">Detail name {index + 1}</Label>
                    <Input
                      id={`attribute-name-${row.id}`}
                      value={row.name}
                      onChange={(event) => updateAttribute(row.id, 'name', event.target.value)}
                      placeholder="Detail name"
                    />
                  </div>
                  <div className="sm:col-auto">
                    <Label htmlFor={`attribute-value-${row.id}`} className="sr-only">Detail value {index + 1}</Label>
                    <Input
                      id={`attribute-value-${row.id}`}
                      value={row.value}
                      onChange={(event) => updateAttribute(row.id, 'value', event.target.value)}
                      placeholder="Value"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove manufacturer detail ${index + 1}`}
                    onClick={() => setAttributeRows((rows) => rows.filter((item) => item.id !== row.id))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
       </div>
      </div>

      <div className="flex shrink-0 justify-end gap-2 border-t pt-4 mt-4">
        <Button variant="outline" onClick={onCancel} disabled={saving}>Cancel</Button>
        <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
      </div>
    </div>
  );
}
