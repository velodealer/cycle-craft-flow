import { partName } from '../../supabase/functions/_shared/part-tokens';
import { specValue } from '@/lib/ebayTitle';

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
/** Shopify's standard category metafields (namespace `shopify`) only accept the store's own list options (metaobjects), never free text. */
export const isShopifyListField = (header: string) => metafieldOf(header)?.ns === 'shopify';

export const BIKE_FIELDS: { value: string; label: string }[] = [
  ['make', 'Make / brand'], ['model', 'Model'], ['year', 'Year'], ['size', 'Size'], ['colour', 'Colour'],
  ['frame_material', 'Frame material'], ['bike_type', 'Bike type'], ['gender', 'Gender'], ['weight_kg', 'Weight (kg)'],
  ['condition', 'Condition'], ['condition_notes', 'Condition notes'], ['description', 'Description'], ['rrp', 'RRP'],
  ['reference', 'Reference'], ['serial_number', 'Serial number'], ['accessories_included', 'Accessories included'], ['is_new', 'Brand new? (yes/no)'],
].map(([value, label]) => ({ value: `field:${value}`, label }));

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const SYNONYMS: Record<string, string> = {
  brand: 'field:make', make: 'field:make', manufacturer: 'field:make', model: 'field:model', year: 'field:year', size: 'field:size', 'frame size': 'field:size',
  color: 'field:colour', colour: 'field:colour', material: 'field:frame_material', 'frame material': 'field:frame_material',
  condition: 'field:condition', rrp: 'field:rrp', gender: 'field:gender', 'brand new bike': 'field:is_new', 'parts changed work done': 'field:condition_notes',
  'condition description parts changed work done': 'field:condition_notes', 'handlebar stem': 'part:handlebar', handlebar: 'part:handlebar', saddles: 'part:saddle',
  'shifters and calipers': 'part:shifters', 'brake type': 'spec:brake_type',
  groupset: 'part:groupset', wheels: 'part:wheelset', wheelset: 'part:wheelset', tyres: 'part:tyres', tires: 'part:tyres',
  crankset: 'part:crank', crank: 'part:crank',
};

const SPEC_SECTION_SLOT: Record<string, string> = { wheels: 'wheelset', tyres: 'tyres', drivetrain: 'groupset', groupset: 'groupset' };

/** Slots that also cover related slots, plus the spec value used when no part is fitted (same sources as eBay). */
const SLOT_GROUPS: Record<string, { slots: string[]; spec?: string[] }> = {
  groupset: { slots: ['groupset'], spec: ['drivetrain.groupset', 'groupset'] },
  wheelset: { slots: ['wheelset', 'front_wheel', 'rear_wheel', 'wheels'], spec: ['wheels.wheelset', 'wheelset'] },
  tyres: { slots: ['tyres', 'front_tyre', 'rear_tyre'], spec: ['tyres.front_size', 'tyres.rear_size'] },
  crank: { slots: ['crank', 'crankset'], spec: ['drivetrain.crankset', 'crankset'] },
};

/** Best-guess source for a metafield header, given the spec keys and part slots this dealer uses. */
export function autoMatch(header: string, specKeys: string[], slots: string[]): string {
  const mf = metafieldOf(header); if (!mf || mf.ns === 'shopify') return '';
  const cands = [norm(mf.label), norm(mf.key)];
  for (const c of cands) if (SYNONYMS[c]) {
    const v = SYNONYMS[c];
    if (v.startsWith('part:') && SLOT_GROUPS[v.slice(5)]) return v;
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
/** Brand + model + part code, never repeating a word — the same text eBay listings use. */
export const partText = (c: any) => txt(partName({ ...c, brand: c.brand ?? c.component?.brand, model: c.model ?? c.component?.model, mpn: c.mpn ?? c.component?.mpn }));

/** Fitted part(s) for a slot, falling back to the bike's spec value; never invented. */
export function slotValue(b: any, parts: any[], slot: string): string {
  const g = SLOT_GROUPS[slot];
  const wanted = g ? g.slots : [slot];
  const names = [...new Set(parts.filter((p) => wanted.includes(txt(p.slot))).map(partText).filter(Boolean))];
  if (names.length) return names.join(', ');
  for (const k of g?.spec ?? []) { const v = specValue(b, k); if (v) return v; }
  return specValue(b, slot);
}

/** Resolve a mapping source for one bike. */
export function resolveSource(src: string, b: any, parts: any[]): string {
  if (!src) return '';
  const [kind, ...rest] = src.split(':'); const k = rest.join(':');
  if (kind === 'text') return k;
  if (kind === 'spec') {
    // Whole spec sections (e.g. "wheels") hold no single value: use the matching fitted parts instead.
    const section = SPEC_SECTION_SLOT[k];
    if (section) return slotValue(b, parts, section);
    return specVal(b, k) || specValue(b, k) || (k === 'brake_type' ? specValue(b, 'brakes.type') : '');
  }
  if (kind === 'part') return slotValue(b, parts, k);
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
