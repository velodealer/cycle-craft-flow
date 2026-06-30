import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';

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
}

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
    setSaving(true);
    const payload = {
      category_id: categoryId,
      brand: brand.trim(),
      model: model.trim(),
      mpn: mpn.trim() || null,
      description: description.trim() || null,
      weight_g: weight ? Number(weight) : null,
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

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
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
        <div className="col-span-2">
          <Label>Description</Label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel} disabled={saving}>Cancel</Button>
        <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
      </div>
    </div>
  );
}
