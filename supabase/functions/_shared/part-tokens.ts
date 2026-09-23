// Part tokens + empty-row hiding, shared by BOTH template renderers
// (src/lib/listingTemplate.ts in the browser, _shared/listing-template.ts on the server)
// so they cannot drift. Runtime-agnostic.
import { partDisplayName } from './part-parser.ts';

const fold = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

const humanise = (key: string) =>
  key.replace(/_/g, ' ').replace(/\b(mm|kg|wh|nm|km|pct|w|g)\b/gi, (m) => m.toUpperCase()).replace(/^./, (c) => c.toUpperCase());

const flatValue = (v: unknown): string => {
  if (v == null || v === '') return '';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (Array.isArray(v)) return v.map(flatValue).filter(Boolean).join(', ');
  if (typeof v === 'object') {
    return Object.entries(v as Record<string, unknown>)
      .map(([k, val]) => { const s = flatValue(val); return s ? `${humanise(k)}: ${s}` : ''; })
      .filter(Boolean).join(', ');
  }
  return String(v);
};

const parsed = (c: any) => (c?.spec_overrides && typeof c.spec_overrides === 'object' && 'spec' in c.spec_overrides) ? c.spec_overrides : null;

/** "Shimano 105 Di2 RD-R7150" — brand + model + mpn, never repeating a word. */
export const partName = (c: any): string => partDisplayName(c?.brand, c?.model || c?.name, c?.mpn);

/** Short spec line for this bike ("50/34T, 175mm"). Empty until the part has been parsed. */
export const partSpec = (c: any): string => String(parsed(c)?.spec ?? '');

/**
 * Detail line. Parsed parts: the spec line only. Unparsed parts: the old fields, with anything
 * already said by the name or by another piece removed, so nothing prints twice.
 */
export function partDetail(c: any): string {
  const p = parsed(c);
  if (p) return String(p.spec ?? '');
  const name = fold(partName(c));
  const pieces = [c?.description || '', c?.mpn ? `MPN: ${c.mpn}` : '', c?.weight_g ? `${c.weight_g} g` : '', flatValue(c?.attributes), c?.notes || ''];
  const out: string[] = [];
  for (const piece of pieces) {
    const f = fold(piece);
    if (!f || f === name) continue;
    if (out.some((o) => fold(o).includes(f))) continue;
    out.push(piece);
  }
  return out.join(' · ');
}

export function partTokens(components: any[] = []): Record<string, string> {
  const out: Record<string, string> = {};
  components.forEach((c) => {
    if (!c?.slot) return;
    const slot = String(c.slot).replace(/\W+/g, '_');
    const p = parsed(c);
    out[`part_${slot}`] = partName(c);
    out[`part_${slot}_detail`] = partDetail(c);
    out[`part_${slot}_brand`] = c.brand ?? '';
    out[`part_${slot}_model`] = c.model ?? '';
    out[`part_${slot}_mpn`] = c.mpn ?? '';
    out[`part_${slot}_spec`] = partSpec(c);
    out[`part_${slot}_extra`] = String(p?.extra ?? '');
  });
  return out;
}

const TOKEN = /\{(\w+)\}/g;
const MARK = '<!--vd-empty-->';

/**
 * Substitutes tokens and drops rows whose placeholders are all empty, then groups left
 * with no rows. A "row" is an innermost <tr>, <li> or <div> containing a placeholder.
 * Text formats: a line whose placeholders are all empty is dropped.
 */
export function substituteHidingEmpty(body: string, values: Record<string, string>, format: 'html' | 'text' = 'html'): string {
  const val = (k: string) => (k in values ? values[k] : '');
  const hasTokens = (s: string) => /\{\w+\}/.test(s);
  const allEmpty = (s: string) => [...s.matchAll(TOKEN)].every((m) => !String(val(m[1]) ?? '').trim());

  if (format !== 'html' && !/<\w+[^>]*>/.test(body)) {
    return body.split('\n').filter((line) => !(hasTokens(line) && allEmpty(line))).join('\n').replace(TOKEN, (_m, k) => val(k));
  }

  let html = body;
  // Pass A: innermost rows whose placeholders are all empty.
  for (const tag of ['tr', 'li', 'div']) {
    const re = new RegExp(`<${tag}\\b[^>]*>((?:(?!<${tag}\\b)(?!</${tag}>)[\\s\\S])*)</${tag}>`, 'gi');
    let prev = '';
    while (prev !== html) {
      prev = html;
      html = html.replace(re, (whole, inner) => (hasTokens(inner) && allEmpty(inner) && !/\bstyle=/.test(whole.slice(0, whole.indexOf('>'))) ? MARK : whole.replace(`<${tag}`, `<${tag}\u0000`)));
    }
    html = html.split(`<${tag}\u0000`).join(`<${tag}`);
  }
  // Pass B: containers left holding only removed rows and headings.
  const visible = (s: string) => s.replace(/<(h[1-6]|dt|th)\b[\s\S]*?<\/\1>/gi, '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
  let prev = '';
  while (prev !== html) {
    prev = html;
    for (const tag of ['dl', 'ul', 'ol', 'table', 'tbody', 'div', 'section']) {
      const re = new RegExp(`<${tag}\\b[^>]*>((?:(?!<${tag}\\b)(?!</${tag}>)[\\s\\S])*)</${tag}>`, 'gi');
      html = html.replace(re, (whole, inner) => (inner.includes(MARK) && !hasTokens(inner) && !/<img\b/i.test(inner) && !visible(inner.split(MARK).join('')) ? MARK : whole));
    }
  }
  return html.split(MARK).join('').replace(TOKEN, (_m, k) => val(k));
}
