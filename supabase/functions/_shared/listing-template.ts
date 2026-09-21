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
    .select('*, components(name, brand, model, mpn, weight_g, description, attributes, component_categories(name))')
    .eq('bike_id', bikeId);
  if (error || !Array.isArray(data)) return [];
  return data.map((row: any) => ({
    slot: row.slot,
    notes: row.notes,
    brand: row.components?.brand,
    model: row.components?.model,
    name: row.components?.name,
    mpn: row.components?.mpn,
    weight_g: row.components?.weight_g,
    description: row.components?.description,
    attributes: row.components?.attributes,
    category: row.components?.component_categories?.name,
  }));
}
