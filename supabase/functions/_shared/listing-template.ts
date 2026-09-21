// Renders the dealer's saved listing format (Settings -> Listing Formats) server-side.
// Mirrors src/lib/listingTemplate.ts so eBay listings look the same as the copy button.

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
    reference: bike.reference ?? '',
    photos: Array.isArray(bike.photos) ? bike.photos.join('\n') : '',
    components: compLines,
  };
}

export function renderTemplate(body: string, bike: any, components: any[] = []): string {
  const values = buildValues(bike, components);
  return body.replace(/\{(\w+)\}/g, (_m, key) => (key in values ? values[key] : ''));
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

/** Removes markup eBay rejects inside item descriptions. */
export function sanitiseForEbay(html: string): string {
  return html
    .replace(/<\s*(script|iframe|form|object|embed|style|link|meta)[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<\s*(script|iframe|form|object|embed|style|link|meta)\b[^>]*\/?>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript:/gi, '')
    .trim();
}

/** Loads the saved format for a platform, preferring the dealer's own row. */
export async function loadListingTemplate(
  supabase: any,
  platform: string,
  businessId?: string | null,
): Promise<TemplateRow | null> {
  const { data, error } = await supabase
    .from('listing_templates')
    .select('platform, format, body, business_id')
    .eq('platform', platform);
  if (error || !Array.isArray(data) || data.length === 0) return null;
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
  const rendered = renderTemplate(tpl.body || '', bike, components).trim();
  if (!rendered) return null;
  const html = tpl.format === 'html' ? rendered : textToHtml(rendered);
  const clean = sanitiseForEbay(html);
  return clean || null;
}

/** Fitted components for the template's {components} token. */
export async function loadBikeComponents(supabase: any, bikeId: string): Promise<any[]> {
  const { data, error } = await supabase
    .from('bike_components')
    .select('*, components(name, brand, model, component_categories(name))')
    .eq('bike_id', bikeId);
  if (error || !Array.isArray(data)) return [];
  return data.map((row: any) => ({
    brand: row.components?.brand,
    model: row.components?.model,
    name: row.components?.name,
    category: row.components?.component_categories?.name,
  }));
}
