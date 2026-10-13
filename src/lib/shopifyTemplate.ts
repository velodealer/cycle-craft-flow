/** Dealer-uploaded Shopify CSV header template: parse, classify, auto-map and resolve values. */
export interface ShopifyCsvTemplate { headers: string[]; mapping: Record<string, string>; fileName?: string; savedAt?: string }

export const shopifyTemplateKey = (businessId: string) => `shopify_csv_template:${businessId}`;

/** Parse only the first CSV record (handles quotes, embedded commas and newlines). */
export function parseHeaderRow(text: string): string[] {
  const out: string[] = []; let cur = ''; let q = false;
  const s = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (q) {
      if (ch === '"' && s[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { out.push(cur.trim()); cur = ''; }
    else if (ch === '\n' || ch === '\r') break;
    else cur += ch;
  }
  out.push(cur.trim());
  return out.filter((h, i, a) => h || i < a.length - 1);
}

const MF = /\(product\.metafields\.([^.()]+)\.([^()]+)\)\s*$/;
export function metafieldOf(header: string): { label: string; ns: string; key: string } | null {
  const m = header.match(MF);
  return m ? { label: header.replace(MF, '').trim(), ns: m[1], key: m[2] } : null;
}

export const BIKE_FIELDS: { value: string; label: string }[] = [
  ['make', 'Make / brand'], ['model', 'Model'], ['year', 'Year'], ['size', 'Size'], ['colour', 'Colour'],
  ['frame_material', 'Frame material'], ['bike_type', 'Bike type'], ['gender', 'Gender'], ['weight_kg', 'Weight (kg)'],
  ['condition', 'Condition'], ['condition_notes', 'Condition notes'], ['description', 'Description'], ['rrp', 'RRP'],
  ['reference', 'Reference'], ['serial_number', 'Serial number'], ['accessories_included', 'Accessories included'], ['is_new', 'Brand new? (yes/no)'],
].map(([value, label]) => ({ value: `field:${value}`, label }));

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const SYNONYMS: Record<string, string> = {
  brand: 'field:make', make: 'field:make', manufacturer: 'field:make', model: 'field:model', year: 'field:year', size: 'field:size', 'frame size': 'field:size',
  color: 'field:colour', colour: 'field:colour', 'color pattern': 'field:colour', material: 'field:frame_material', 'frame material': 'field:frame_material',
  condition: 'field:condition', rrp: 'field:rrp', gender: 'field:gender', 'brand new bike': 'field:is_new', 'parts changed work done': 'field:condition_notes',
  'condition description parts changed work done': 'field:condition_notes', 'handlebar stem': 'part:handlebar', handlebar: 'part:handlebar', saddles: 'part:saddle',
  'shifters and calipers': 'part:shifters', 'brake type': 'spec:brake_type',
};

/** Best-guess source for a metafield header, given the spec keys and part slots this dealer uses. */
export function autoMatch(header: string, specKeys: string[], slots: string[]): string {
  const mf = metafieldOf(header); if (!mf) return '';
  const cands = [norm(mf.label), norm(mf.key)];
  for (const c of cands) if (SYNONYMS[c]) {
    const v = SYNONYMS[c];
    if (v.startsWith('part:') && !slots.includes(v.slice(5))) { const alt = slots.find((s) => norm(s).includes(norm(v.slice(5)))); if (alt) return `part:${alt}`; continue; }
    return v;
  }
  for (const c of cands) {
    const slot = slots.find((s) => norm(s) === c || norm(s).replace(/s$/, '') === c.replace(/s$/, ''));
    if (slot) return `part:${slot}`;
    const sk = specKeys.find((k) => norm(k) === c);
    if (sk) return `spec:${sk}`;
  }
  return '';
}

const txt = (v: unknown) => (v === null || v === undefined ? '' : String(v)).trim();
const specVal = (b: any, k: string) => { const x = b?.spec_values?.[k]; return txt(typeof x === 'object' && x ? (x.value ?? x.label ?? '') : x); };
const partText = (c: any) => {
  const brand = txt(c.brand ?? c.component?.brand), model = txt(c.model ?? c.component?.model);
  return (model.toLowerCase().startsWith(brand.toLowerCase()) && brand ? model : [brand, model].filter(Boolean).join(' ')).trim();
};

/** Resolve a mapping source for one bike. */
export function resolveSource(src: string, b: any, parts: any[]): string {
  if (!src) return '';
  const [kind, ...rest] = src.split(':'); const k = rest.join(':');
  if (kind === 'text') return k;
  if (kind === 'spec') return specVal(b, k);
  if (kind === 'part') return parts.filter((p) => txt(p.slot) === k).map(partText).filter(Boolean).join(', ');
  if (kind === 'field') {
    if (k === 'is_new') return /new/i.test(txt(b.condition)) && !/like/i.test(txt(b.condition)) ? 'TRUE' : 'FALSE';
    if (k === 'rrp') return txt(b.rrp ?? specVal(b, 'rrp') ?? specVal(b, 'msrp'));
    if (k === 'accessories_included') return b.has_accessories ? txt(b.accessories_included) : '';
    return txt(b[k]);
  }
  return '';
}

export const sourceLabel = (src: string) => {
  if (!src) return 'Leave blank';
  const [kind, ...rest] = src.split(':'); const k = rest.join(':');
  if (kind === 'field') return BIKE_FIELDS.find((f) => f.value === src)?.label ?? k;
  if (kind === 'spec') return `Spec: ${k.replace(/_/g, ' ')}`;
  if (kind === 'part') return `Fitted part: ${k.replace(/_/g, ' ')}`;
  if (kind === 'text') return `Text: ${k}`;
  return src;
};
