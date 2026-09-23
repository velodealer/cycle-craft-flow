import { supabase } from '@/integrations/supabase/client';
import { SPEC_SECTIONS } from '@/lib/bikeSpec';

export type ListingPlatform = 'ebay' | 'shopify' | 'instagram' | 'facebook';
export type ListingFormat = 'html' | 'text';

export const PLATFORMS: { value: ListingPlatform; label: string }[] = [
  { value: 'ebay', label: 'eBay' },
  { value: 'shopify', label: 'Shopify' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Facebook' },
];

export interface ListingField {
  token: string;
  label: string;
}

export const LISTING_FIELDS: ListingField[] = [
  { token: 'title', label: 'Title (year make model)' },
  { token: 'make', label: 'Make' },
  { token: 'model', label: 'Model' },
  { token: 'year', label: 'Year' },
  { token: 'colour', label: 'Colour' },
  { token: 'size', label: 'Size' },
  { token: 'gender', label: 'Gender' },
  { token: 'bike_type', label: 'Bike type' },
  { token: 'frame_material', label: 'Frame material' },
  { token: 'frame_number', label: 'Frame number' },
  { token: 'mpn', label: 'Manufacturer part number (MPN)' },
  { token: 'serial_number', label: 'Serial number' },
  { token: 'condition', label: 'Condition' },
  { token: 'condition_notes', label: 'Condition notes' },
  { token: 'description', label: 'Description' },
  { token: 'listing_description', label: 'Listing description' },
  { token: 'weight_kg', label: 'Weight (kg)' },
  { token: 'is_electric', label: 'Electric (yes/no)' },
  { token: 'has_suspension_fork', label: 'Suspension fork (yes/no)' },
  { token: 'has_rear_shock', label: 'Rear shock (yes/no)' },
  { token: 'has_dropper', label: 'Dropper post (yes/no)' },
  { token: 'accessories_included', label: 'Accessories included' },
  { token: 'asking_price', label: 'Asking price (£)' },
  { token: 'sale_price', label: 'Sale price (£)' },
  { token: 'sku', label: 'SKU' },
  { token: 'reference', label: 'Bike reference' },
  { token: 'photos', label: 'Photos (newline-joined URLs)' },
  { token: 'components', label: 'Components list (one per line)' },
  { token: 'components_table', label: 'Components table (HTML)' },
  { token: 'spec_list', label: 'Full specification list (one per line)' },
  { token: 'spec_table', label: 'Full specification table (HTML)' },
];

export interface ListingFieldGroup {
  id: string;
  title: string;
  fields: ListingField[];
}

/** Bike basics + every component slot and spec field, grouped for the picker. */
export const LISTING_FIELD_GROUPS: ListingFieldGroup[] = [
  { id: 'bike', title: 'Bike details', fields: LISTING_FIELDS },
  ...SPEC_SECTIONS.map((section) => ({
    id: section.id,
    title: section.title,
    fields: [
      ...(section.slots || []).flatMap((slot) => [
        { token: `part_${slot.slot}`, label: `${slot.label} — brand & model` },
        { token: `part_${slot.slot}_detail`, label: `${slot.label} — full details` },
      ]),
      ...(section.fields || []).map((field) => ({
        token: `spec_${section.path || section.id}_${field.key.replace(/\./g, '_')}`,
        label: field.label,
      })),
    ],
  })).filter((g) => g.fields.length > 0),
];

const yn = (v: any) => (v === true ? 'Yes' : v === false ? 'No' : '');
const money = (v: any) => {
  const n = Number(v);
  if (!v || Number.isNaN(n)) return '';
  return `£${n.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
};

export const humanise = (key: string) =>
  key
    .replace(/_/g, ' ')
    .replace(/\b(mm|kg|wh|nm|km|pct|w|g)\b/gi, (m) => m.toUpperCase())
    .replace(/^./, (c) => c.toUpperCase());

const flatValue = (v: any): string => {
  if (v == null || v === '') return '';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (Array.isArray(v)) return v.map(flatValue).filter(Boolean).join(', ');
  if (typeof v === 'object') {
    return Object.entries(v)
      .map(([k, val]) => {
        const s = flatValue(val);
        return s ? `${humanise(k)}: ${s}` : '';
      })
      .filter(Boolean)
      .join(', ');
  }
  return String(v);
};

/** Every spec_values entry as a {spec_section_field} token. */
export function specTokens(bike: any): Record<string, string> {
  const out: Record<string, string> = {};
  const spec = bike?.spec_values;
  if (!spec || typeof spec !== 'object') return out;
  Object.entries(spec).forEach(([section, value]) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.entries(value as Record<string, any>).forEach(([key, val]) => {
        out[`spec_${section}_${key}`] = flatValue(val);
      });
    } else {
      out[`spec_${section}`] = flatValue(value);
    }
  });
  return out;
}

const partName = (c: any) => [c.brand, c.model || c.name].filter(Boolean).join(' ');

const partDetail = (c: any) =>
  [
    c.description || '',
    c.mpn ? `MPN: ${c.mpn}` : '',
    c.weight_g ? `${c.weight_g} g` : '',
    flatValue(c.attributes),
    c.notes || '',
  ]
    .filter(Boolean)
    .join(' · ');

/** Every fitted part as {part_<slot>} / {part_<slot>_detail} tokens. */
export function partTokens(components: any[] = []): Record<string, string> {
  const out: Record<string, string> = {};
  components.forEach((c) => {
    if (!c?.slot) return;
    const slot = String(c.slot).replace(/\W+/g, '_');
    out[`part_${slot}`] = partName(c);
    out[`part_${slot}_detail`] = partDetail(c);
  });
  return out;
}

export function buildValues(bike: any, components: any[] = []): Record<string, string> {
  const compLines = components
    .map((c) => {
      const cat = c.category || c.component_categories?.name || c.slot_label || '';
      const name = partName(c);
      return cat ? `${cat}: ${name}` : name;
    })
    .filter(Boolean)
    .map((l) => `• ${l}`)
    .join('\n');

  const compRows = components
    .filter((c) => partName(c))
    .map((c) => {
      const label = c.slot_label || c.category || c.component_categories?.name || '';
      const detail = partDetail(c);
      return `<tr><th align="left">${label}</th><td>${partName(c)}${detail ? `<br><small>${detail}</small>` : ''}</td></tr>`;
    })
    .join('');

  const specs = specTokens(bike);
  const specLines = Object.entries(specs)
    .filter(([, v]) => v)
    .map(([k, v]) => `• ${humanise(k.replace(/^spec_/, ''))}: ${v}`)
    .join('\n');
  const specRows = Object.entries(specs)
    .filter(([, v]) => v)
    .map(([k, v]) => `<tr><th align="left">${humanise(k.replace(/^spec_/, ''))}</th><td>${v}</td></tr>`)
    .join('');

  return {
    ...specs,
    ...partTokens(components),
    spec_list: specLines,
    spec_table: specRows ? `<table>${specRows}</table>` : '',
    components_table: compRows ? `<table>${compRows}</table>` : '',
    title: [bike.year, bike.make, bike.model].filter(Boolean).join(' '),
    make: bike.make ?? '',
    model: bike.model ?? '',
    year: bike.year ? String(bike.year) : '',
    colour: bike.colour ?? '',
    size: bike.size ?? '',
    gender: bike.gender ?? '',
    bike_type: bike.bike_type ?? '',
    frame_material: bike.frame_material ?? '',
    frame_number: bike.frame_number ?? '',
    mpn: (bike as any).mpn ?? '',
    serial_number: bike.serial_number ?? '',
    condition: bike.condition ?? '',
    condition_notes: bike.condition_notes ?? '',
    description: bike.description ?? '',
    listing_description: bike.listing_description ?? '',
    weight_kg: bike.weight_kg ? String(bike.weight_kg) : '',
    is_electric: yn(bike.is_electric),
    has_suspension_fork: yn(bike.has_suspension_fork),
    has_rear_shock: yn(bike.has_rear_shock),
    has_dropper: yn(bike.has_dropper),
    accessories_included: bike.accessories_included ?? '',
    asking_price: money(bike.asking_price),
    sale_price: money(bike.sale_price),
    sku: bike.sku ?? '',
    reference: bike.reference ?? '',
    photos: Array.isArray(bike.photos) ? bike.photos.join('\n') : '',
    components: compLines,
  };
}

export function renderTemplate(body: string, bike: any, components: any[] = []): string {
  const values = buildValues(bike, components);
  return body.replace(/\{(\w+)\}/g, (_m, key) => (key in values ? values[key] : ''));
}

export async function fetchTemplates() {
  const { data, error } = await supabase.from('listing_templates' as any).select('*');
  if (error) throw error;
  return (data || []) as unknown as Array<{
    id: string;
    platform: ListingPlatform;
    format: ListingFormat;
    body: string;
  }>;

}

function htmlToPlain(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|tr)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function copyTextWithExecCommand(text: string): Promise<boolean> {
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    ta.style.top = '0';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export async function copyListing(
  platform: ListingPlatform,
  bike: any,
  components: any[] = [],
): Promise<{ ok: boolean; format?: ListingFormat; reason?: string }> {
  const { data, error } = await supabase
    .from('listing_templates' as any)
    .select('*')
    .eq('platform', platform)
    .maybeSingle();
  if (error) return { ok: false, reason: error.message };
  if (!data) return { ok: false, reason: 'No template configured' };
  const tpl = data as any;
  const format: ListingFormat = tpl.format === 'html' ? 'html' : 'text';
  const rendered = renderTemplate(tpl.body || '', bike, components);

  if (format === 'html') {
    // Put the raw HTML source on both text/html (for rich editors) and text/plain
    // (so eBay-style HTML source editors paste the markup verbatim).
    if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
      try {
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/html': new Blob([rendered], { type: 'text/html' }),
            'text/plain': new Blob([rendered], { type: 'text/plain' }),
          }),
        ]);
        return { ok: true, format };
      } catch {
        // fall through
      }
    }
    if (await copyTextWithExecCommand(rendered)) {
      return { ok: true, format };
    }
    try {
      await navigator.clipboard.writeText(rendered);
      return { ok: true, format };
    } catch (e: any) {
      return { ok: false, reason: e?.message || 'Clipboard failed' };
    }
  }

  try {
    await navigator.clipboard.writeText(rendered);
    return { ok: true, format };
  } catch (e: any) {
    return { ok: false, reason: e?.message || 'Clipboard failed' };
  }
}
