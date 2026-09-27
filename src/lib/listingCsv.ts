import { supabase } from '@/integrations/supabase/client';
import { fetchBikeComponents } from '../../supabase/functions/_shared/bike-components';
import { renderTemplate } from '@/lib/listingTemplate';
import { effectiveListingImages } from '@/lib/listingImages';
import { applyChannelMarkup, type MarkupRule } from '@/lib/channelPricing';

export type CsvChannel = 'ebay' | 'shopify';

/** Quotes a value for CSV (commas, quotes and line breaks are safe). */
export function csvCell(v: unknown): string {
  if (v == null) return '';
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
export function toCsv(rows: unknown[][]): string {
  return '\uFEFF' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

const txt = (v: unknown) => (v == null ? '' : String(v).trim());
const title = (b: any) => [b.year, b.make, b.model, b.size ? `Size ${b.size}` : '', b.colour].map(txt).filter(Boolean).join(' ');
const sv = (b: any, ...keys: string[]) => {
  const v = b?.spec_values && typeof b.spec_values === 'object' ? b.spec_values : {};
  for (const k of keys) { const x = v[k]; const t = typeof x === 'object' && x ? (x.value ?? x.label ?? '') : x; if (txt(t)) return txt(t); }
  return '';
};
const specList = (b: any): [string, unknown][] => Object.entries(b?.spec_values && typeof b.spec_values === 'object' ? b.spec_values : {})
  .map(([k, x]: [string, any]): [string, string] => [k.replace(/_/g, ' '), txt(typeof x === 'object' && x ? (x.value ?? x.label ?? '') : x)])
  .filter(([, v]) => v);
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function partsHtml(components: any[]): string {
  const rows = components
    .map((c) => {
      const name = [c.brand ?? c.component?.brand, c.model ?? c.component?.model].map(txt).filter(Boolean).join(' ');
      const slot = txt(c.slot).replace(/_/g, ' ');
      return name ? `<li><strong>${slot}:</strong> ${name}</li>` : '';
    })
    .filter(Boolean);
  return rows.length ? `<h3>Specification</h3><ul>${rows.join('')}</ul>` : '';
}

function fallbackHtml(b: any, components: any[]): string {
  const facts: [string, unknown][] = [
    ['Make', b.make], ['Model', b.model], ['Year', b.year], ['Size', b.size], ['Colour', b.colour],
    ['Frame material', b.frame_material], ['Bike type', b.bike_type], ['Weight (kg)', b.weight_kg],
    ['Condition', b.condition], ['Accessories', b.has_accessories ? b.accessories_included : ''], ['Reference', b.reference],
    ...specList(b),
  ];
  const list = facts.filter(([, v]) => txt(v)).map(([k, v]) => `<li><strong>${k}:</strong> ${txt(v)}</li>`).join('');
  const notes = txt(b.condition_notes) ? `<h3>Condition</h3><p>${txt(b.condition_notes)}</p>` : '';
  return `<h2>${title(b)}</h2>${txt(b.description) ? `<p>${txt(b.description)}</p>` : ''}<ul>${list}</ul>${partsHtml(components)}${notes}`;
}

const ebayCondition = (c: unknown) => {
  const s = txt(c).toLowerCase();
  if (s.includes('new') && !s.includes('like')) return 1000;
  return 3000;
};

export interface CsvResult { csv: string; filename: string; warnings: string[] }

export async function buildListingCsv(channel: CsvChannel, bikeIds: string[], markup: MarkupRule): Promise<CsvResult> {
  if (!bikeIds.length) throw new Error('Choose at least one bike to export.');
  const [{ data: bikes, error }, { data: tpl }] = await Promise.all([
    supabase.from('bikes').select('*').in('id', bikeIds),
    supabase.from('listing_templates' as any).select('*').eq('platform', channel).maybeSingle(),
  ]);
  if (error) throw new Error(`Could not load bikes: ${error.message}`);
  const warnings: string[] = [];
  const list = (bikes as any[]) ?? [];
  const withParts = await Promise.all(list.map(async (b) => ({ b, parts: await fetchBikeComponents(supabase as any, b.id).catch(() => [] as any[]) })));

  const describe = (b: any, parts: any[]) => {
    const body = (tpl as any)?.body as string | undefined;
    return body ? renderTemplate(body, b, parts, 'html') : fallbackHtml(b, parts);
  };
  for (const { b } of withParts) {
    const miss = [!b.asking_price && 'price', !effectiveListingImages(b).length && 'photos', !txt(b.bike_type) && 'bike type'].filter(Boolean);
    if (miss.length) warnings.push(`${b.reference || `${b.make} ${b.model}`}: no ${miss.join(', ')}`);
  }

  const rows: unknown[][] = [];
  if (channel === 'shopify') {
    rows.push(['Handle', 'Title', 'Body (HTML)', 'Vendor', 'Product Category', 'Type', 'Tags', 'Published', 'Option1 Name', 'Option1 Value',
      'Variant SKU', 'Variant Grams', 'Variant Inventory Tracker', 'Variant Inventory Qty', 'Variant Inventory Policy', 'Variant Fulfillment Service',
      'Variant Price', 'Variant Compare At Price', 'Variant Requires Shipping', 'Variant Taxable', 'Image Src', 'Image Position', 'Image Alt Text',
      'SEO Title', 'SEO Description', 'Status']);
    for (const { b, parts } of withParts) {
      const t = title(b);
      const handle = slug(`${t}-${b.reference || b.id.slice(0, 8)}`);
      const imgs = effectiveListingImages(b);
      const price = applyChannelMarkup(b.asking_price, markup);
      const tags = [b.bike_type, b.make, b.frame_material, b.size && `Size ${b.size}`, b.year].map(txt).filter(Boolean).join(', ');
      const html = describe(b, parts);
      rows.push([handle, t, html, b.make, 'Sporting Goods > Outdoor Recreation > Cycling > Bicycles', b.bike_type || 'Bicycle', tags, 'TRUE',
        'Size', txt(b.size) || 'Default Title', b.reference || b.id, b.weight_kg ? Math.round(Number(b.weight_kg) * 1000) : '', 'shopify', 1, 'deny', 'manual',
        price ?? '', '', 'TRUE', 'TRUE', imgs[0] ?? '', imgs[0] ? 1 : '', imgs[0] ? t : '',
        t.slice(0, 70), html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 320), price ? 'active' : 'draft']);
      imgs.slice(1).forEach((src, i) => {
        const r = new Array(rows[0].length).fill('');
        r[0] = handle; r[20] = src; r[21] = i + 2; r[22] = t;
        rows.push(r);
      });
    }
  } else {
    rows.push(['*Action(SiteID=UK|Country=GB|Currency=GBP|Version=1193|CC=UTF-8)', 'CustomLabel', '*Category', '*Title', '*ConditionID', 'ConditionDescription',
      '*Description', '*Format', '*Duration', '*StartPrice', '*Quantity', 'PicURL', 'BestOfferEnabled', '*Location',
      'C:Brand', 'C:Model', 'C:Bike Type', 'C:Frame Size', 'C:Colour', 'C:Frame Material', 'C:Wheel Size', 'C:Brake Type', 'C:Gear Change Mechanism',
      'C:Suspension Type', 'C:Number of Gears', 'C:Year', 'C:Department']);
    for (const { b, parts } of withParts) {
      const price = applyChannelMarkup(b.asking_price, markup);
      rows.push(['Add', b.reference || b.id, 177831, title(b).slice(0, 80), ebayCondition(b.condition), txt(b.condition_notes).slice(0, 1000),
        describe(b, parts), 'FixedPrice', 'GTC', price ?? '', 1, effectiveListingImages(b).slice(0, 24).join('|'), 1, '',
        b.make, b.model, b.bike_type, b.size, b.colour, b.frame_material, sv(b, 'wheel_size', 'wheels_size'), sv(b, 'brake_type', 'brakes'),
        sv(b, 'groupset', 'gear_change_mechanism', 'shifters'), sv(b, 'suspension_type', 'suspension'), sv(b, 'number_of_gears', 'gears', 'speeds'), b.year, b.gender || 'Unisex Adults']);
    }
    warnings.push('Before uploading, fill in Location (postcode) and pick your postage, returns and payment policies in eBay Seller Hub.');
  }
  const date = new Date().toISOString().slice(0, 10);
  return { csv: toCsv(rows), filename: `velodealer-${channel}-${date}.csv`, warnings };
}

export function downloadCsv(csv: string, filename: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
