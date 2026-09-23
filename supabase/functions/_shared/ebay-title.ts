// Smart eBay title builder. Copy of src/lib/ebayTitle.ts — keep both in step.

export const EBAY_TITLE_MAX = 80;
export const DEFAULT_TITLE_FORMAT =
  '{make} {model} {groupset} {frame_material} {bike_type} {feature} {size} {wheel_size} {year}';

export const TITLE_TOKENS: { token: string; label: string }[] = [
  { token: 'make', label: 'Make' },
  { token: 'model', label: 'Model' },
  { token: 'groupset', label: 'Groupset' },
  { token: 'frame_material', label: 'Frame material' },
  { token: 'bike_type', label: 'Bike type' },
  { token: 'feature', label: 'Key feature (Di2, eTap, Disc…)' },
  { token: 'size', label: 'Frame size' },
  { token: 'wheel_size', label: 'Wheel size (MTB/gravel)' },
  { token: 'year', label: 'Year' },
  { token: 'colour', label: 'Colour' },
];

const TYPE_WORD: Record<string, string> = {
  road: 'Road Bike', gravel: 'Gravel Bike', mtb_hardtail: 'Hardtail MTB', mtb_full_sus: 'Full Suspension MTB',
  bmx: 'BMX', hybrid: 'Hybrid Bike', city: 'City Bike', electric: 'E-Bike', folding: 'Folding Bike',
  cargo: 'Cargo Bike', tt: 'TT Bike', touring: 'Touring Bike', cyclocross: 'Cyclocross Bike',
  track: 'Track Bike', tandem: 'Tandem', recumbent: 'Recumbent', kids: 'Kids Bike',
};

const ACRONYMS = ['BMX', 'MTB', 'XL', 'XS', 'XXL', 'Di2', 'SRAM', 'AXS', 'eTap', 'GRX', 'XT', 'XTR', 'SLX', 'GX', 'NX', 'SX', 'XX1', 'X01', 'TT', 'CX', 'SL', 'SLR', 'CF', 'SL7', 'SL8', 'AL', 'E-Bike', 'EQ', 'LTD'];
const ACR_MAP = new Map(ACRONYMS.map((a) => [a.toLowerCase(), a]));

/** Reads a spec value, either "section.key" or a bare key found in any section. */
export function specValue(bike: any, path: string): string {
  const spec = bike?.spec_values;
  if (!spec || typeof spec !== 'object') return '';
  const pick = (v: unknown) => (v === null || v === undefined || typeof v === 'object' ? '' : String(v).trim());
  if (path.includes('.')) {
    const [s, k] = path.split('.');
    return pick(spec?.[s]?.[k]);
  }
  if (pick(spec[path])) return pick(spec[path]);
  for (const g of Object.values(spec)) {
    if (g && typeof g === 'object') {
      const v = pick((g as any)[path]);
      if (v) return v;
    }
  }
  return '';
}

function tidyWord(w: string): string {
  const acr = ACR_MAP.get(w.toLowerCase());
  if (acr) return acr;
  // Only tidy words written entirely in capitals (shouting); keep mixed case as typed.
  if (w.length > 3 && w === w.toUpperCase() && /[A-Z]/.test(w) && !/\d/.test(w)) {
    return w.charAt(0) + w.slice(1).toLowerCase();
  }
  return w;
}

function tidy(value: string): string {
  return value.replace(/\s+/g, ' ').trim().split(' ').map(tidyWord).join(' ');
}

function formatSize(size: string): string {
  const s = size.trim();
  if (!s) return '';
  if (/^\d{2}(\.\d)?$/.test(s)) return `${s}cm`;
  if (/^\d{2}(\.\d)?\s*cm$/i.test(s)) return s.replace(/\s+/g, '').toLowerCase();
  const letters: Record<string, string> = { xs: 'XS', s: 'Small', m: 'Medium', l: 'Large', xl: 'XL', xxl: 'XXL', sm: 'Small', md: 'Medium', lg: 'Large' };
  return letters[s.toLowerCase()] || s;
}

function keyFeature(bike: any): string {
  const hay = [specValue(bike, 'drivetrain.groupset'), bike?.model, specValue(bike, 'brakes.type')].join(' ').toLowerCase();
  if (bike?.is_electric || bike?.bike_type === 'electric') {
    const motor = specValue(bike, 'ebike.motor_brand');
    return motor ? `${motor} Motor` : 'Electric';
  }
  if (/di2/.test(hay)) return 'Di2';
  if (/etap|axs/.test(hay)) return /axs/.test(hay) ? 'AXS' : 'eTap';
  if (bike?.bike_type === 'mtb_full_sus' || bike?.has_rear_shock) return 'Full Suspension';
  if (/disc/.test(hay)) return 'Disc';
  return '';
}

export function titleValues(bike: any): Record<string, string> {
  const type = String(bike?.bike_type ?? '').toLowerCase();
  const wheelTypes = ['mtb_hardtail', 'mtb_full_sus', 'gravel'];
  const material = String(bike?.frame_material || specValue(bike, 'frame.material') || '');
  return {
    make: String(bike?.make ?? ''),
    model: String(bike?.model ?? ''),
    groupset: specValue(bike, 'drivetrain.groupset'),
    frame_material: /carbon|titanium|steel|alu/i.test(material) ? material.replace(/aluminium|aluminum|alloy/i, 'Alloy') : '',
    bike_type: TYPE_WORD[type] || (type ? type.replace(/_/g, ' ') : ''),
    feature: keyFeature(bike),
    size: formatSize(String(bike?.size || specValue(bike, 'frame.size') || '')),
    wheel_size: wheelTypes.includes(type) ? specValue(bike, 'wheels.wheel_size') : '',
    year: bike?.year ? String(bike.year) : '',
    colour: String(bike?.colour ?? ''),
  };
}

/**
 * Builds a title from the format. Words already used are not repeated.
 * When too long, the last items in the format are dropped first — never cut mid-word.
 */
export function buildEbayTitle(bike: any, format?: string | null): string {
  const fmt = (format && format.trim()) || DEFAULT_TITLE_FORMAT;
  const values = titleValues(bike);
  const parts: string[] = [];
  const seen = new Set<string>();
  const re = /\{(\w+)\}|([^{}\s]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(fmt))) {
    const raw = m[1] ? values[m[1]] ?? '' : m[2];
    const words = tidy(raw).split(' ').filter((w) => w && !seen.has(w.toLowerCase()));
    if (!words.length) continue;
    words.forEach((w) => seen.add(w.toLowerCase()));
    parts.push(words.join(' '));
  }
  while (parts.length > 1 && parts.join(' ').length > EBAY_TITLE_MAX) parts.pop();
  let title = parts.join(' ');
  if (title.length > EBAY_TITLE_MAX) title = title.slice(0, EBAY_TITLE_MAX).replace(/\s+\S*$/, '');
  return title;
}

/** The title actually sent: the per-bike custom title when set, otherwise the built one. */
export function finalEbayTitle(bike: any, format?: string | null, override?: string | null): string {
  const o = String(override ?? '').replace(/\s+/g, ' ').trim();
  if (o) return o.slice(0, EBAY_TITLE_MAX);
  return buildEbayTitle(bike, format);
}
