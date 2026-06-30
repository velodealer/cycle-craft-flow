import { supabase } from '@/integrations/supabase/client';

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
  { token: 'photos', label: 'Photos (newline-joined URLs)' },
  { token: 'components', label: 'Components list (one per line)' },
];

const yn = (v: any) => (v === true ? 'Yes' : v === false ? 'No' : '');
const money = (v: any) => {
  const n = Number(v);
  if (!v || Number.isNaN(n)) return '';
  return `£${n.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
};

export function buildValues(bike: any, components: any[] = []): Record<string, string> {
  const compLines = components
    .map((c) => {
      const cat = c.category || c.component_categories?.name || '';
      const name = [c.brand, c.model || c.name].filter(Boolean).join(' ');
      return cat ? `${cat}: ${name}` : name;
    })
    .filter(Boolean)
    .map((l) => `• ${l}`)
    .join('\n');

  return {
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
