// Fitted-part parser (Checkpoint 2). Pure and runtime-agnostic: no imports, no I/O.
// Turns one part's source text (99spokes description / per-bike note / library text)
// into brand, model, part number (MPN) and a short spec line for THIS bike.
//
// Rules:
//   - Never invent. A part number is only produced from a code that is in the text.
//     Adding a Shimano slot prefix (RD-, ST-, ...) to a bare series code is allowed and
//     is marked mpn_inferred = true.
//   - Brand comes from a dictionary, or the bike's own make for frame/fork and house
//     parts. Otherwise brand = null plus a flag. Brand is never the model or a fragment.
//   - Per-size strings are resolved to the bike's size; the full text is kept as source.

export interface ParseInput {
  slot: string;
  text: string | null;             // chosen source text
  source?: 'catalog' | 'notes' | 'library' | 'name';
  bikeMake?: string | null;
  bikeSize?: string | null;
  isElectric?: boolean | null;
  bikeGroupset?: string | null;    // spec_values.drivetrain.groupset
  libraryAttributes?: Record<string, unknown> | null;
}

export interface ParsedPart {
  slot: string;                    // target slot (may differ, e.g. Di2 battery)
  brand: string | null;
  model: string | null;
  mpn: string | null;
  mpn_inferred: boolean;
  model_inferred: boolean;
  brand_source: 'text' | 'bike_make' | null;
  spec: string;                    // short line for this bike, e.g. "50/34T, 175mm"
  extra: string;                   // other clauses from the text, not repeated in name/spec
  attributes: Record<string, unknown>;
  resolved_text: string;           // source text resolved to this bike's size
  source_text: string;
  size_resolved: boolean;
  flags: string[];
}

export const BRANDS = [
  'Shimano', 'SRAM', 'Campagnolo', 'Praxis', 'Bontrager', 'Trek', 'Giant', 'Liv', 'Cervélo', 'Specialized',
  'Roval', 'DT Swiss', 'Vittoria', 'Continental', 'Schwalbe', 'Pirelli', 'Michelin', 'Maxxis', 'Panaracer',
  'Prologo', 'Fizik', 'Selle Italia', 'Selle San Marco', 'Brooks', 'FSA', 'KMC', 'Zipp', 'Mavic', 'Fulcrum',
  'Hunt', 'ENVE', 'Reynolds', 'Stratus', 'Deda', 'Ritchey', 'Easton', 'Rotor', 'Chris King', 'Hope', 'PRO',
  'RockShox', 'Fox', '1AER', 'Vision', 'Cannondale', 'BMC', 'Pinarello', 'Canyon', 'Scott', 'Orbea',
  'Syncros', 'Lizard Skins', 'Supacaz', 'Look', 'Time', 'Wahoo', 'Garmin', 'Quarq', 'Stages', '4iiii',
  'Magura', 'TRP', 'Hayes', 'Race Face', 'e*thirteen', 'Industry Nine', 'WTB', 'Novatec', 'Chosen',
];

// Parts sold under the bike maker's own name without the maker written in the text.
const HOUSE_LINES: Record<string, string[]> = {
  specialized: ['S-Works', 'Body Geometry', 'Power', 'Future', 'Venge', 'Hover', 'Turbo', 'Romin', 'Phenom'],
  giant: ['Contact', 'Advanced-grade', 'Advanced-Grade', 'Variant', 'D-Fuse'],
  liv: ['Contact', 'Advanced-grade', 'Advanced-Grade'],
  trek: ['OCLV'],
};

const SHIMANO_PREFIX: Record<string, string> = {
  shifters: 'ST', rear_derailleur: 'RD', front_derailleur: 'FD', crank: 'FC', cassette: 'CS',
  chain: 'CN', brakes: 'BR', disc_rotors: 'SM', brake_levers: 'ST', groupset_battery: 'BT', ebike_battery: 'BT',
};

const GROUPSETS = ['Dura-Ace', 'Ultegra', '105', 'Tiagra', 'Sora', 'Claris', 'GRX', 'XTR', 'Deore XT', 'XT', 'SLX', 'Deore', 'Cues'];

const FRAME_SLOTS = new Set(['frame', 'fork']);

const fold = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const clean = (s: string) => s.replace(/\s+/g, ' ').replace(/\s+,/g, ',').replace(/^[,;\s]+|[,;\s]+$/g, '').trim();

export function fixMojibake(s: string): string {
  return s.replace(/√©/g, 'é').replace(/√®/g, 'è').replace(/√º/g, 'ü').replace(/Ã©/g, 'é').replace(/Ã¨/g, 'è');
}

/** Removes an immediately repeated word group: "Bontrager Elite Bontrager Elite VR-C" -> "Bontrager Elite VR-C". */
export function dedupeWords(s: string): string {
  let prev = '';
  let out = s;
  while (prev !== out) {
    prev = out;
    out = out.replace(/(^|\s)((?:[\p{L}\d][\p{L}\d.\-/]*)(?:\s+[\p{L}\d][\p{L}\d.\-/]*){0,3})\s+\2(?=\s|,|$)/u, '$1$2');
  }
  return out;
}

const LETTER_SIZE: Record<string, string> = {
  xxs: 'XXS', xs: 'XS', s: 'S', sm: 'S', small: 'S', m: 'M', md: 'M', medium: 'M', ml: 'M/L', 'm/l': 'M/L',
  l: 'L', lg: 'L', large: 'L', xl: 'XL', xxl: 'XXL',
};

export function sizeKey(size: string | null | undefined): string | null {
  const s = String(size ?? '').trim();
  if (!s) return null;
  const num = s.match(/^(\d{2}(?:\.\d)?)\s*(cm)?$/i);
  if (num) return num[1];
  const first = s.split(/\s+/)[0].toLowerCase();
  return LETTER_SIZE[first] ?? null;
}

const normSizeToken = (t: string) => {
  const x = t.trim();
  if (/^\d{2}(\.\d)?$/.test(x)) return x;
  return LETTER_SIZE[x.toLowerCase()] ?? null;
};

/** Resolves "Size: 47, 50, X; Size: 52, Y" and "S:40cm, M:42cm" strings to the bike's size. */
export function resolveForSize(text: string, bikeSize: string | null | undefined): { text: string; resolved: boolean; hadSizes: boolean } {
  const key = sizeKey(bikeSize);
  // Format A: segments starting "Size:"
  if (/(^|;\s*)Size:\s*/i.test(text)) {
    const segments = text.split(/;\s*(?=Size:)/i);
    for (const seg of segments) {
      const body = seg.replace(/^Size:\s*/i, '');
      const parts = body.split(/,\s*/);
      const sizes: string[] = [];
      let i = 0;
      while (i < parts.length && normSizeToken(parts[i])) { sizes.push(normSizeToken(parts[i])!); i++; }
      if (key && sizes.includes(key)) return { text: clean(parts.slice(i).join(', ')), resolved: true, hadSizes: true };
    }
    return { text, resolved: false, hadSizes: true };
  }
  // Format B: "S:40cm, M:42cm, M/L:42cm"
  const re = /\b(XXS|XS|S|M|M\/L|L|XL|XXL):\s*(\d+(?:\.\d+)?\s*(?:mm|cm))/g;
  const matches = [...text.matchAll(re)];
  if (matches.length >= 2) {
    const hit = key ? matches.find((m) => m[1] === key) : undefined;
    const start = matches[0].index!;
    const last = matches[matches.length - 1];
    const end = last.index! + last[0].length;
    if (!hit) return { text, resolved: false, hadSizes: true };
    return { text: clean(`${text.slice(0, start)}${hit[2].replace(/\s+/g, '')}${text.slice(end)}`), resolved: true, hadSizes: true };
  }
  return { text, resolved: false, hadSizes: false };
}

/** "Front: X, Rear: X" -> X. Different halves -> clauses common to both, in front order. */
export function collapseFrontRear(text: string): { text: string; differs: boolean } {
  const m = text.match(/^\s*Front:\s*([\s\S]*?),\s*Rear:\s*([\s\S]*)$/i);
  if (!m) return { text, differs: false };
  const f = clean(m[1]);
  const r = clean(m[2]);
  if (fold(f) === fold(r)) return { text: f, differs: false };
  const rc = new Set(r.split(/,\s*/).map(fold));
  const common = f.split(/,\s*/).filter((c) => rc.has(fold(c)));
  return { text: common.length ? common.join(', ') : f, differs: true };
}

function findBrand(text: string): { brand: string; rest: string } | null {
  const t = fold(text);
  const sorted = [...BRANDS].sort((a, b) => b.length - a.length);
  for (const b of sorted) {
    const fb = fold(b);
    if (t.startsWith(fb) && (t.length === fb.length || /[\s,]/.test(t[fb.length]))) {
      return { brand: b, rest: clean(text.slice(b.length)) };
    }
  }
  return null;
}

function houseBrand(text: string, make: string | null | undefined): string | null {
  if (!make) return null;
  const lines = HOUSE_LINES[fold(make)] ?? [];
  const t = fold(text);
  return lines.some((l) => t.startsWith(fold(l))) ? make : null;
}

const SERIES_GROUPSET: Array<[RegExp, string]> = [
  [/^R?9\d{3}$/, 'Dura-Ace'], [/^R?8\d{3}$/, 'Ultegra'], [/^R?7\d{3}$/, '105'], [/^R?4\d{3}$/, 'Tiagra'],
  [/^M9\d{3}$/, 'XTR'], [/^M8\d{3}$/, 'Deore XT'], [/^M7\d{3}$/, 'SLX'], [/^M6\d{3}$/, 'Deore'],
  [/^RX-?8\d{2}$/, 'GRX 800'], [/^RX-?6\d{2}$/, 'GRX 600'], [/^RX-?4\d{2}$/, 'GRX 400'],
];

interface ShimanoInfo { model: string | null; mpn: string | null; inferred: boolean; modelInferred: boolean; series: string | null }

function parseShimano(text: string, slot: string): ShimanoInfo {
  const di2 = /\bDi2\b/i.test(text);
  let groupset: string | null = null;
  for (const g of GROUPSETS) {
    if (new RegExp(`(^|[\\s,])${g.replace(/[-]/g, '\\-')}(?=$|[\\s,])`, 'i').test(text)) { groupset = g; break; }
  }
  if (groupset === 'Ultegra' && /\bUltegra RX\b/i.test(text)) groupset = 'Ultegra RX';

  // explicit prefixed code in text
  const explicit = text.match(/\b(ST|RD|FD|FC|CS|CN|BR|SM|BT|BB|WH|SL|EW|RT)-([A-Z]{0,3}\d{2,4}[A-Z0-9]*)\b/);
  let series: string | null = explicit ? explicit[2] : null;
  let mpn: string | null = explicit ? `${explicit[1]}-${explicit[2]}` : null;
  let inferred = false;
  if (!series) {
    const s = text.match(/\b(RX-?\d{3}|R\d{4}|M\d{4}|RT\d{2,3}|\d{4})\b/);
    if (s) {
      series = s[1].replace('-', '');
      if (/^\d{4}$/.test(series) && /^[789]/.test(series) && (!groupset || ['105', 'Ultegra', 'Dura-Ace'].includes(groupset))) series = `R${series}`;
      else if (/^\d{4}$/.test(series)) series = null; // bare number with no road groupset: not a code we trust
    }
    if (series) {
      const prefix = /^RT/.test(series) ? 'SM' : SHIMANO_PREFIX[slot];
      if (prefix) { mpn = `${prefix}-${series}`; inferred = true; }
    }
  }
  let modelInferred = false;
  if (!groupset && series) {
    const hit = SERIES_GROUPSET.find(([re]) => re.test(series!));
    if (hit) { groupset = hit[1]; modelInferred = true; }
  }
  if (groupset === 'GRX' && series) {
    const hit = SERIES_GROUPSET.find(([re]) => re.test(series!));
    if (hit && hit[1].startsWith('GRX')) groupset = hit[1];
  }
  let model = groupset ? `${groupset}${di2 && !/Di2/.test(groupset) ? ' Di2' : ''}` : null;
  if (!model && series && /^RT/.test(series)) model = series;
  return { model, mpn, inferred, modelInferred, series };
}

const pick = (re: RegExp, s: string) => s.match(re);

/** Structured facts + a short spec line per slot. */
function extractSpec(slot: string, text: string, model: string | null): { attrs: Record<string, unknown>; spec: string[]; used: RegExp[] } {
  const a: Record<string, unknown> = {};
  const spec: string[] = [];
  const used: RegExp[] = [];
  const take = (re: RegExp) => { used.push(re); return pick(re, text); };
  let m: RegExpMatchArray | null;

  const speedRe = /\b(\d{1,2})[\s-]*(?:speed|spd)\b/i;
  const xRe = /\b[123]x(\d{1,2})\b/;
  const speed = (m = take(speedRe)) ? Number(m[1]) : (m = take(xRe)) ? Number(m[1]) : null;
  if (speed) a.speeds = speed;

  switch (slot) {
    case 'shifters': case 'chain':
      if (speed) spec.push(`${speed} speed`);
      break;
    case 'front_derailleur':
      if ((m = take(/\b(braze-on|clamp-on|band-on|direct mount)\b/i))) { a.mount = m[1].toLowerCase(); spec.push(m[1].toLowerCase()); }
      take(/\bdown swing\b/i);
      break;
    case 'rear_derailleur':
      if ((m = take(/\b(\d{2})T max cog\b/i))) { a.max_cog_t = Number(m[1]); spec.push(`${m[1]}T max cog`); }
      break;
    case 'crank':
      if ((m = take(/\b(\d{2})\s*\/\s*(\d{2})\s*T?\b/))) { const big = Math.max(+m[1], +m[2]); const small = Math.min(+m[1], +m[2]); a.chainrings = `${big}/${small}`; spec.push(`${big}/${small}T`); }
      if ((m = take(/\b(1[5-8]\d(?:\.5)?)\s*mm(?:\s*length)?\b/i))) { a.length_mm = Number(m[1]); spec.push(`${m[1]}mm`); }
      break;
    case 'cassette':
      if ((m = take(/\b(\d{1,2})\s*[-x]\s*(\d{2})\s*t?\b/i))) { a.range = `${m[1]}-${m[2]}`; spec.push(`${m[1]}-${m[2]}`); }
      if (speed) spec.push(`${speed} speed`);
      break;
    case 'brakes': case 'brake_levers':
      if ((m = take(/\bhydraulic(?:\s+disc)?\b/i))) { a.kind = 'hydraulic disc'; spec.push('hydraulic disc'); }
      else if ((m = take(/\bmechanical(?:\s+disc)?\b/i))) { a.kind = 'mechanical disc'; spec.push('mechanical disc'); }
      if ((m = take(/\b(flat|post)[\s-]mount\b/i))) { a.mount = `${m[1].toLowerCase()} mount`; spec.push(`${m[1].toLowerCase()} mount`); }
      if ((m = take(/\[F\]\s*(\d{3})mm/i))) a.rotor_front_mm = Number(m[1]);
      if ((m = take(/\[R\]\s*(\d{3})mm/i))) a.rotor_rear_mm = Number(m[1]);
      take(/\bcaliper\b/i);
      break;
    case 'disc_rotors':
      if ((m = take(/\b(center\s?lock|centre\s?lock|6[\s-]bolt)\b/i))) { const v = /6/.test(m[1]) ? '6-bolt' : 'centerlock'; a.mount = v; spec.push(v); }
      if ((m = take(/\b(1[46]0|180|203)\s*mm\b/i))) { a.size_mm = Number(m[1]); spec.push(`${m[1]}mm`); }
      break;
    case 'wheelset': {
      if ((m = take(/\b(carbon|alloy|aluminium|aluminum)\b/i))) { const v = /carbon/i.test(m[1]) ? 'carbon' : 'alloy'; a.material = v; spec.push(v); }
      if ((m = take(/\btubeless[\s-]ready\b/i))) { a.tubeless_ready = true; spec.push('tubeless ready'); }
      if ((m = take(/\b(\d{2})\s*mm\s*(?:rim\s*)?depth\b/i))) { a.depth_mm = Number(m[1]); spec.push(`${m[1]}mm depth`); }
      break;
    }
    case 'front_tyre': case 'rear_tyre': {
      if ((m = take(/\b(700|650)\s*x\s*(\d{2})\s*(?:mm|c)\b/i))) { a.size = `${m[1]}x${m[2]}c`; spec.push(`${m[1]}x${m[2]}c`); }
      else if ((m = take(/\b(\d{2})c\b/i))) { a.size = `${m[1]}c`; spec.push(`${m[1]}c`); }
      if (take(/\btubeless\b/i)) a.tubeless = true;
      break;
    }
    case 'handlebars':
      if ((m = take(/\b(alloy|aluminium|aluminum|carbon)\b/i))) { const v = /carbon/i.test(m[1]) ? 'carbon' : 'alloy'; a.material = v; spec.push(v); }
      if ((m = take(/\b(\d{2})\s*cm(?:\s*width)?\b/i))) { a.width_cm = Number(m[1]); spec.push(`${m[1]}cm`); }
      break;
    case 'stem':
      if ((m = take(/\b(\d{2,3})\s*mm(?:\s*length)?\b(?!\s*reach)/i)) && !/31\.8|35\.0/.test(m[0])) { a.length_mm = Number(m[1]); spec.push(`${m[1]}mm`); }
      if ((m = take(/\b(\d{1,2})[\s-]*degree\b/i))) { a.angle_deg = Number(m[1]); spec.push(`${m[1]}°`); }
      break;
    case 'seatpost':
      if ((m = take(/\b(-?\d{1,2}(?:\/\+\d{1,2})?)\s*mm offset\b/i))) { a.offset = `${m[1]}mm`; spec.push(`${m[1]}mm offset`); }
      if ((m = take(/\b(short|tall|long)\s+length\b/i))) { a.length = m[1].toLowerCase(); spec.push(m[1].toLowerCase()); }
      break;
    case 'saddle':
      if ((m = take(/\b((?:hollow\s+)?(?:steel|titanium|carbon|cr-mo|chromoly|manganese|alloy|oversized carbon))\s+rails\b/i))) { a.rails = m[1].toLowerCase(); spec.push(`${m[1].toLowerCase()} rails`); }
      if ((m = take(/\b(1[2-6]\d)\s*mm(?:\s*width)?\b/i))) { a.width_mm = Number(m[1]); spec.push(`${m[1]}mm`); }
      break;
    case 'fork':
      if ((m = take(/\bfull[\s-](carbon|composite)\b/i))) spec.push(`full ${m[1].toLowerCase()}`);
      break;
  }
  void model;
  return { attrs: a, spec, used };
}

function splitClauses(s: string): string[] {
  return s.split(/,\s*/).map((c) => c.trim()).filter(Boolean);
}

export function parsePart(input: ParseInput): ParsedPart {
  const flags: string[] = [];
  const source_text = fixMojibake(String(input.text ?? '')).trim();
  let slot = input.slot;

  const sized = resolveForSize(source_text, input.bikeSize);
  if (sized.hadSizes && !sized.resolved) flags.push(`size list present but bike size "${input.bikeSize ?? ''}" not found in it — left unresolved`);
  const fr = collapseFrontRear(sized.text);
  if (fr.differs) flags.push('front and rear differ — kept the parts they share');
  let text = dedupeWords(fr.text.replace(/^(19|20)\d{2}\s+/, ''));
  const resolved_text = text;

  // Brand
  let brand: string | null = null;
  let brand_source: ParsedPart['brand_source'] = null;
  let rest = text;
  const found = findBrand(text);
  if (found) { brand = found.brand; brand_source = 'text'; rest = found.rest; }
  else if (FRAME_SLOTS.has(slot) && input.bikeMake) { brand = input.bikeMake; brand_source = 'bike_make'; }
  else {
    const hb = houseBrand(text, input.bikeMake);
    if (hb) { brand = hb; brand_source = 'bike_make'; flags.push(`brand taken from bike make (${hb} house part)`); }
    else flags.push('brand not recognised — left blank');
  }
  if (brand && found) rest = dedupeWords(rest.replace(new RegExp(`^${brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+`, 'i'), ''));

  // Model + MPN
  let model: string | null = null;
  let mpn: string | null = null;
  let mpn_inferred = false;
  let model_inferred = false;
  const clauses = splitClauses(rest);
  let modelClauseIdx = 0;

  if (brand === 'Shimano') {
    const s = parseShimano(text, slot);
    model = s.model; mpn = s.mpn; mpn_inferred = s.inferred; model_inferred = s.modelInferred;
    if (s.modelInferred && model) flags.push(`model "${model}" inferred from series code ${s.series}`);
    if (mpn_inferred) flags.push(`part number ${mpn} built from series code in text — unverified`);
  } else {
    const explicit = text.match(/\b([A-Z]{2}-\d{3,4}[A-Z]?)\b/); // e.g. SRAM XG-1270
    if (explicit) mpn = explicit[1];
    // model = first clause after brand; if empty, the next clause
    if (!clauses[0] && clauses.length > 1) modelClauseIdx = 1;
    let mc = clauses[modelClauseIdx] ?? '';
    if (FRAME_SLOTS.has(slot)) {
      mc = mc.replace(/^(ultralight|lightweight|all-new)\s+/i, '');
      mc = mc.split(/\s+full[\s-](?:carbon|composite)\b/i)[0];
    }
    if (mpn) mc = mc.replace(mpn, '');
    mc = mc.replace(/\b\d{1,2}[\s-]*(?:speed|spd)\b/ig, '').replace(/\b(700|650)\s*x\s*\d{2}\s*(mm|c)\b/ig, '').replace(/\b\d{2}c\b/ig, '');
    model = clean(mc) || null;
  }

  // Guards: never brand = model, never a fragment as brand
  if (brand && model && fold(brand) === fold(model)) { model = null; flags.push('model was just the brand again — cleared'); }
  if (brand && /[:]/.test(brand)) { brand = null; flags.push('brand looked like a fragment — cleared'); }

  // Spec
  const { attrs, spec } = extractSpec(slot, text, model);

  // Extra = clauses not used for model, not covered by spec, not the brand
  const specFold = spec.map(fold);
  const extra = clauses
    .filter((_, i) => brand === 'Shimano' ? true : i !== modelClauseIdx)
    .filter((c) => {
      const f = fold(c);
      if (!f) return false;
      if (model && fold(model).includes(f)) return false;
      if (mpn && f.includes(fold(mpn))) return false;
      if (specFold.some((s) => f.includes(s) || s.includes(f))) return false;
      if (/^\d{1,2}[\s-]*(speed|spd)$/i.test(c)) return false;
      if (/^(\d{2})\s*[-x/]\s*(\d{2})t?$/i.test(c)) return false;
      if (/(length|width)$/i.test(c) && specFold.some((s) => f.startsWith(s.replace(/[a-z°]+$/, '')))) return false;
      if (brand === 'Shimano' && model && f.startsWith(fold(model.split(' ')[0]))) return false;
      if (brand === 'Shimano' && /^(r|rx|m)?-?\d{3,4}\b/i.test(c)) return false;
      return true;
    })
    .join(', ');

  // Library attribute conflicts
  const lib = input.libraryAttributes ?? {};
  if (typeof lib.speeds === 'number' && typeof attrs.speeds === 'number' && lib.speeds !== attrs.speeds) {
    flags.push(`library says ${lib.speeds} speed, this bike's text says ${attrs.speeds} — per-bike value used`);
  }

  // Di2 / AXS battery filed as an e-bike battery
  if (slot === 'ebike_battery' && !input.isElectric && /\b(Di2|BT-DN|eTap|AXS)\b/i.test(text + ' ' + (mpn ?? ''))) {
    slot = 'groupset_battery';
    flags.push('Di2/AXS battery on a non-e-bike — moved from ebike_battery to groupset_battery');
  }

  // Chain/cassette from a different groupset than the bike
  const bg = String(input.bikeGroupset ?? '');
  if (brand === 'Shimano' && ['chain', 'cassette', 'crank', 'rear_derailleur', 'front_derailleur', 'shifters'].includes(slot) && model && bg) {
    const g = model.replace(/\s*Di2$/, '').split(' ')[0];
    if (!fold(bg).includes(fold(g))) flags.push(`${g} ${slot.replace(/_/g, ' ')} on a ${bg} bike — matches the source text, confirm on the bike`);
  }

  return {
    slot, brand, model, mpn, mpn_inferred, model_inferred, brand_source,
    spec: spec.join(', '), extra, attributes: attrs, resolved_text, source_text,
    size_resolved: sized.resolved, flags,
  };
}

/** Joins brand + model + mpn without repeating words: "Shimano" "RT70" "SM-RT70" -> "Shimano SM-RT70". */
export function partDisplayName(brand?: string | null, model?: string | null, mpn?: string | null): string {
  const out: string[] = [];
  const seen = (s: string) => out.some((o) => fold(o).includes(fold(s)));
  const b = (brand ?? '').trim();
  let m = (model ?? '').trim();
  const p = (mpn ?? '').trim();
  if (b) out.push(b);
  if (m && b && fold(m).startsWith(fold(b) + ' ')) m = m.slice(b.length).trim();
  if (m && !(p && fold(p).includes(fold(m))) && !(b && fold(b) === fold(m))) out.push(m);
  if (p && !seen(p)) out.push(p);
  return out.join(' ');
}

/** 99spokes component key for a VeloDealer slot. */
export const SPOKES_KEY: Record<string, string> = {
  bottom_bracket: 'bottomBracket', disc_rotors: 'discRotors', ebike_battery: 'battery', groupset_battery: 'battery',
  front_tyre: 'tires', rear_tyre: 'tires', handlebars: 'handlebar', wheelset: 'rims', front_derailleur: 'frontDerailleur',
  rear_derailleur: 'rearDerailleur', brake_levers: 'brakeLevers', front_hub: 'frontHub', rear_hub: 'rearHub',
  power_meter: 'powerMeter',
};
