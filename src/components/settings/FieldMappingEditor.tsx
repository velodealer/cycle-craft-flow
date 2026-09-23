import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { renderTemplate } from '@/lib/listingTemplate';

export type ShopifyMetafieldRow = { key: string; type: string; value: string };
export type SquarespaceMap = {
  tags?: string[];
  categories?: string[];
  seo_title?: string;
  seo_description?: string;
  url_slug?: string;
};

const TYPES = [
  { value: 'single_line_text_field', label: 'Single line text' },
  { value: 'multi_line_text_field', label: 'Multi-line text' },
  { value: 'number_integer', label: 'Whole number' },
  { value: 'number_decimal', label: 'Decimal number' },
  { value: 'boolean', label: 'True / false' },
];

const KEY_RE = /^[A-Za-z0-9_]{2,}\.[A-Za-z0-9_]{1,}$/;
export const validMetafieldKey = (k: string) => KEY_RE.test(k) && k.length >= 3 && k.length <= 64;

const SHOPIFY_PRESET: ShopifyMetafieldRow[] = [
  { key: 'bike.brand', type: 'single_line_text_field', value: '{make}' },
  { key: 'bike.model', type: 'single_line_text_field', value: '{model}' },
  { key: 'bike.year', type: 'number_integer', value: '{year}' },
  { key: 'bike.frame_size', type: 'single_line_text_field', value: '{size}' },
  { key: 'bike.colour', type: 'single_line_text_field', value: '{colour}' },
  { key: 'bike.frame_material', type: 'single_line_text_field', value: '{frame_material}' },
  { key: 'bike.wheel_size', type: 'single_line_text_field', value: '{spec_wheels_wheel_size}' },
  { key: 'bike.groupset', type: 'single_line_text_field', value: '{spec_drivetrain_groupset}' },
  { key: 'bike.bike_type', type: 'single_line_text_field', value: '{bike_type}' },
  { key: 'bike.condition', type: 'single_line_text_field', value: '{condition}' },
  { key: 'bike.electric', type: 'boolean', value: '{is_electric}' },
];

const plain = (t: string, bike: any, comps: any[]) =>
  renderTemplate(t || '', bike, comps).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

export function ShopifyMetafieldEditor({ rows, onChange, bike, components }: {
  rows: ShopifyMetafieldRow[]; onChange: (r: ShopifyMetafieldRow[]) => void; bike: any; components: any[];
}) {
  const set = (i: number, patch: Partial<ShopifyMetafieldRow>) =>
    onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const move = (i: number, d: number) => {
    const n = [...rows]; const j = i + d; if (j < 0 || j >= n.length) return;
    [n[i], n[j]] = [n[j], n[i]]; onChange(n);
  };
  const addPreset = () => {
    const have = new Set(rows.map((r) => r.key));
    onChange([...rows, ...SHOPIFY_PRESET.filter((p) => !have.has(p.key))]);
  };
  return (
    <div className="space-y-3 rounded border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Label>Metafield mapping</Label>
          <p className="text-xs text-muted-foreground">Fill Shopify product metafields from bike fields. Empty values are skipped.</p>
        </div>
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="outline" onClick={addPreset}>Add starter set</Button>
          <Button type="button" size="sm" variant="outline" onClick={() => onChange([...rows, { key: '', type: 'single_line_text_field', value: '' }])}>
            <Plus className="mr-1 h-3 w-3" /> Add row
          </Button>
        </div>
      </div>
      {rows.length === 0 && <p className="text-xs text-muted-foreground">No metafields mapped yet.</p>}
      {rows.map((r, i) => {
        const bad = r.key && !validMetafieldKey(r.key);
        return (
          <div key={i} className="grid gap-2 md:grid-cols-[1fr_170px_1fr_auto] items-start">
            <div>
              <Input value={r.key} onChange={(e) => set(i, { key: e.target.value.trim() })} placeholder="namespace.key" className="h-8 font-mono text-xs" />
              {bad && <p className="text-[11px] text-destructive mt-1">Use namespace.key (letters, numbers, _)</p>}
            </div>
            <Select value={r.type} onValueChange={(v) => set(i, { type: v })}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>{TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
            </Select>
            <div>
              <Input value={r.value} onChange={(e) => set(i, { value: e.target.value })} placeholder="{size}" className="h-8 font-mono text-xs" />
              <p className="text-[11px] text-muted-foreground mt-1 truncate">→ {plain(r.value, bike, components) || '(empty, skipped)'}</p>
            </div>
            <div className="flex gap-1">
              <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={() => move(i, -1)} aria-label="Move up"><ArrowUp className="h-3 w-3" /></Button>
              <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={() => move(i, 1)} aria-label="Move down"><ArrowDown className="h-3 w-3" /></Button>
              <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={() => onChange(rows.filter((_, j) => j !== i))} aria-label="Remove"><Trash2 className="h-3 w-3" /></Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ListEditor({ label, items, onChange, bike, components, placeholder }: {
  label: string; items: string[]; onChange: (v: string[]) => void; bike: any; components: any[]; placeholder: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <Button type="button" size="sm" variant="outline" className="h-7" onClick={() => onChange([...items, ''])}><Plus className="mr-1 h-3 w-3" /> Add</Button>
      </div>
      {items.map((v, i) => (
        <div key={i} className="flex gap-2 items-start">
          <div className="flex-1">
            <Input value={v} onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))} placeholder={placeholder} className="h-8 font-mono text-xs" />
            <p className="text-[11px] text-muted-foreground mt-1">→ {plain(v, bike, components) || '(empty, skipped)'}</p>
          </div>
          <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={() => onChange(items.filter((_, j) => j !== i))} aria-label="Remove"><Trash2 className="h-3 w-3" /></Button>
        </div>
      ))}
    </div>
  );
}

export function SquarespaceMappingEditor({ map, onChange, bike, components }: {
  map: SquarespaceMap; onChange: (m: SquarespaceMap) => void; bike: any; components: any[];
}) {
  const text = (k: keyof SquarespaceMap, label: string, ph: string) => (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Input value={(map[k] as string) ?? ''} onChange={(e) => onChange({ ...map, [k]: e.target.value })} placeholder={ph} className="h-8 font-mono text-xs" />
      <p className="text-[11px] text-muted-foreground">→ {plain((map[k] as string) ?? '', bike, components) || '(empty, default used)'}</p>
    </div>
  );
  return (
    <div className="space-y-4 rounded border p-3">
      <div>
        <Label>Field mapping</Label>
        <p className="text-xs text-muted-foreground">Squarespace has no metafields, so bike fields map to tags, categories, SEO and the page link instead.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <ListEditor label="Tags" items={map.tags ?? []} onChange={(tags) => onChange({ ...map, tags })} bike={bike} components={components} placeholder="{make}" />
        <ListEditor label="Categories" items={map.categories ?? []} onChange={(categories) => onChange({ ...map, categories })} bike={bike} components={components} placeholder="{bike_type}" />
      </div>
      {text('seo_title', 'SEO title', '{year} {make} {model} – {size}')}
      {text('seo_description', 'SEO description', 'Used {make} {model} in {condition} condition.')}
      {text('url_slug', 'URL slug', '{make}-{model}-{year}-{reference}')}
    </div>
  );
}
