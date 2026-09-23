// Renders the dealer's saved listing format (Settings -> Listing Formats) server-side.
// Mirrors src/lib/listingTemplate.ts so eBay listings look the same as the copy button.
import { fetchBikeComponents, isPartsFetchError } from './bike-components.ts';
import { partName, partDetail, partTokens as sharedPartTokens, substituteHidingEmpty } from './part-tokens.ts';
export { PartsFetchError, isPartsFetchError } from './bike-components.ts';

export interface TemplateRow {
  platform: string;
  format: 'html' | 'text' | string;
  body: string;
}

const yn = (v: unknown) => (v === true ? 'Yes' : v === false ? 'No' : '');

const money = (v: unknown) => {
  const n = Number(v);
  if (!v || Number.isNaN(n)) return '';
  return `£${n.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
};

const humanise = (key: string) =>
  key
    .replace(/_/g, ' ')
    .replace(/\b(mm|kg|wh|nm|km|pct|w|g)\b/gi, (m) => m.toUpperCase())
    .replace(/^./, (c) => c.toUpperCase());

const flatValue = (v: unknown): string => {
  if (v == null || v === '') return '';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (Array.isArray(v)) return v.map(flatValue).filter(Boolean).join(', ');
  if (typeof v === 'object') {
    return Object.entries(v as Record<string, unknown>)
      .map(([k, val]) => {
        const s = flatValue(val);
        return s ? `${humanise(k)}: ${s}` : '';
      })
      .filter(Boolean)
      .join(', ');
  }
  return String(v);
};

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


/** Every fitted part as {part_<slot>}, _detail, _brand, _model, _mpn, _spec, _extra tokens. */
export const partTokens = sharedPartTokens;

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

/** Fills placeholders; rows (and then groups) whose placeholders are all empty are left out. */
export function renderTemplate(body: string, bike: any, components: any[] = [], format: 'html' | 'text' = 'html'): string {
  const values = buildValues(bike, components);
  return substituteHidingEmpty(body, values, format);
}

const escapeHtml = (value: unknown) =>
  String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Plain text -> simple HTML paragraphs so eBay renders line breaks. */
export function textToHtml(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

/** Removes markup eBay rejects inside item descriptions. Keeps CSS (<style>) intact. */
export function sanitiseForEbay(html: string): string {
  return html
    // active content eBay blocks outright
    .replace(/<\s*(script|iframe|form|object|embed|applet)[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<\s*(script|iframe|form|object|embed|applet)\b[^>]*\/?>/gi, '')
    // document-level tags that do nothing inside a description
    .replace(/<\s*\/?\s*(html|head|body)\b[^>]*>/gi, '')
    .replace(/<\s*title\b[^>]*>[\s\S]*?<\s*\/\s*title\s*>/gi, '')
    .replace(/<\s*(meta|link|base)\b[^>]*\/?>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript:/gi, '')
    .trim();
}


export class TemplateFetchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TemplateFetchError';
  }
}

/** True for load failures that must stop a publish instead of falling back to a default. */
export function isPublishBlockingError(e: unknown): boolean {
  return isPartsFetchError(e) || (!!e && (e as any).name === 'TemplateFetchError');
}

/** Loads the saved format for a platform, preferring the dealer's own row. null = none saved; throws on query failure. */
export async function loadListingTemplate(
  supabase: any,
  platform: string,
  businessId?: string | null,
): Promise<TemplateRow | null> {
  const { data, error } = await supabase
    .from('listing_templates')
    .select('platform, format, body, business_id')
    .eq('platform', platform);
  if (error) throw new TemplateFetchError(`Could not load the ${platform} listing format: ${error.message}`);
  if (!Array.isArray(data) || data.length === 0) return null;
  const own = businessId ? data.find((r: any) => r.business_id === businessId) : null;
  const row = own || data.find((r: any) => !r.business_id) || data[0];
  if (!row || !String(row.body ?? '').trim()) return null;
  return row as TemplateRow;
}

/** Renders the saved format as eBay-safe HTML, or null when there is nothing usable. */
export function renderListingHtml(
  tpl: TemplateRow | null,
  bike: any,
  components: any[] = [],
): string | null {
  if (!tpl) return null;
  const rendered = renderTemplate(tpl.body || '', bike, components, tpl.format === 'html' ? 'html' : 'text').trim();
  if (!rendered) return null;
  const html = tpl.format === 'html' ? rendered : textToHtml(rendered);
  const clean = sanitiseForEbay(html);
  return clean || null;
}

/** Renders a mapping value template as trimmed plain text (HTML stripped). */
export function renderFieldValue(template: string, bike: any, components: any[] = []): string {
  return renderTemplate(String(template ?? ''), bike, components)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

/** Loads the dealer's field mapping (Settings -> Listing Formats) for a platform. null = none; throws on query failure. */
export async function loadFieldMap(supabase: any, platform: string, businessId?: string | null): Promise<any> {
  const { data, error } = await supabase
    .from('listing_templates')
    .select('field_map, business_id')
    .eq('platform', platform);
  if (error) throw new TemplateFetchError(`Could not load the ${platform} field mapping: ${error.message}`);
  if (!Array.isArray(data) || data.length === 0) return null;
  const own = businessId ? data.find((r: any) => r.business_id === businessId) : null;
  return (own || data.find((r: any) => !r.business_id) || null)?.field_map ?? null;
}

/** Fitted components for the template's tokens. Throws PartsFetchError on failure — never []. */
export async function loadBikeComponents(supabase: any, bikeId: string): Promise<any[]> {
  return await fetchBikeComponents(supabase, bikeId);
}
