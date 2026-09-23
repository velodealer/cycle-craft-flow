// Item specifics: maps VeloDealer bike data onto the category's eBay aspects,
// matches values to eBay's own choices and scores completeness.
import { specValue } from './ebay-title.ts';

export interface AspectResult {
  aspects: Record<string, string[]>;
  requiredTotal: number;
  recommendedTotal: number;
  recommendedFilled: number;
  missingRequired: string[];
  missingRecommended: string[];
  unmapped: { name: string; value: string }[];
}

const EBAY_BIKE_TYPE: Record<string, string> = {
  road: 'Road Bike', gravel: 'Gravel Bike', mtb_hardtail: 'Mountain Bike', mtb_full_sus: 'Mountain Bike',
  bmx: 'BMX', hybrid: 'Hybrid Bike', city: 'Comfort Bike', electric: 'Electric Bike', folding: 'Folding Bike',
  cargo: 'Cargo Bike', tt: 'Triathlon Bike', touring: 'Touring Bike', cyclocross: 'Cyclocross Bike',
  track: 'Track Bike', tandem: 'Tandem', recumbent: 'Recumbent Bike', kids: 'Kids Bike',
};

export function ebayBikeTypeValue(bike: any): string | null {
  const raw = String(bike?.bike_type ?? '').trim().toLowerCase();
  if (!raw) return null;
  return EBAY_BIKE_TYPE[raw] || raw.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

const has = (v: unknown) => v !== null && v !== undefined && String(v).trim() !== '';

function handlebarType(type: string): string {
  if (['road', 'gravel', 'cyclocross', 'touring', 'track'].includes(type)) return 'Drop Bar';
  if (type === 'tt') return 'Aero Bar';
  if (['mtb_hardtail', 'mtb_full_sus', 'bmx'].includes(type)) return 'Riser Bar';
  if (['hybrid', 'city', 'folding', 'electric', 'cargo'].includes(type)) return 'Flat Bar';
  return '';
}

function suspension(bike: any): string {
  if (bike?.has_rear_shock || bike?.bike_type === 'mtb_full_sus') return 'Full Suspension';
  if (bike?.has_suspension_fork || bike?.bike_type === 'mtb_hardtail') return 'Front Suspension';
  if (['road', 'gravel', 'tt', 'track', 'cyclocross'].includes(bike?.bike_type)) return 'Rigid';
  return '';
}

function gears(bike: any): string {
  const speed = parseInt(specValue(bike, 'drivetrain.speed'), 10);
  if (!speed) return specValue(bike, 'gears');
  const cfg = parseInt(specValue(bike, 'drivetrain.config'), 10) || 1;
  return String(speed * cfg);
}

function department(bike: any): string {
  const g = String(bike?.gender ?? '').toLowerCase();
  if (bike?.bike_type === 'kids') return 'Kids';
  if (/women|female|ladies/.test(g)) return 'Women';
  if (/^men|male/.test(g)) return 'Men';
  if (/unisex/.test(g)) return 'Unisex Adults';
  return '';
}

function features(bike: any): string[] {
  const out: string[] = [];
  const brakes = specValue(bike, 'brakes.type').toLowerCase();
  const groupset = specValue(bike, 'drivetrain.groupset').toLowerCase();
  if (/disc/.test(brakes)) out.push('Disc Brakes');
  if (/hydraulic/.test(brakes)) out.push('Hydraulic Brakes');
  if (/di2|etap|axs|electronic/.test(groupset)) out.push('Electronic Shifting');
  if (bike?.has_dropper) out.push('Dropper Seatpost');
  if (specValue(bike, 'wheels.tubeless_ready') === 'true') out.push('Tubeless Ready');
  if (specValue(bike, 'frame.internal_cable_routing') === 'true') out.push('Internal Cable Routing');
  if (bike?.has_suspension_fork || bike?.has_rear_shock) out.push('Suspension');
  return out;
}

/** Candidate values keyed by a lowercase aspect-name pattern. First match wins. */
function candidates(bike: any, brand: string): Array<[RegExp, string | string[]]> {
  const type = String(bike?.bike_type ?? '').toLowerCase();
  const frameMaterial = bike?.frame_material || specValue(bike, 'frame.material');
  const tyre = specValue(bike, 'tyres.front_size') || specValue(bike, 'tyres.rear_size');
  const tyreWidth = (tyre.match(/(\d{2}(?:\.\d)?)\s*(?:mm|c)\b/i)?.[1]) || (tyre.match(/x\s*(\d(?:\.\d+)?)/)?.[1] ? `${tyre.match(/x\s*(\d(?:\.\d+)?)/)![1]}"` : '');
  const e = bike?.is_electric || type === 'electric';
  return [
    [/^brand$/, brand],
    [/^model$/, bike?.model ?? ''],
    [/^(bike )?type$/, ebayBikeTypeValue(bike) ?? ''],
    [/^frame size/, bike?.size || specValue(bike, 'frame.size')],
    [/^colou?r$/, bike?.colour ?? ''],
    [/^frame material/, frameMaterial],
    [/^wheel size/, specValue(bike, 'wheels.wheel_size')],
    [/^(number of gears|gears)/, gears(bike)],
    [/^brake type/, specValue(bike, 'brakes.type')],
    [/^suspension( type)?$/, suspension(bike)],
    [/^(gender|department)$/, department(bike)],
    [/^(year|model year|year manufactured)$/, bike?.year ? String(bike.year) : ''],
    [/^handlebar type/, handlebarType(type)],
    [/^(groupset|components|component brand)/, specValue(bike, 'drivetrain.groupset')],
    [/^features?$/, features(bike)],
    [/^tyre width|^tire width/, tyreWidth],
    [/^(fork )?travel|^suspension travel/, specValue(bike, 'fork.travel_mm') ? `${specValue(bike, 'fork.travel_mm')} mm` : ''],
    [/^mpn$/, bike?.mpn ?? ''],
    [/^motor (power|wattage)|^power/, e && specValue(bike, 'ebike.motor_power_w') ? `${specValue(bike, 'ebike.motor_power_w')} W` : ''],
    [/^battery (capacity|power)/, e && specValue(bike, 'ebike.battery_wh') ? `${specValue(bike, 'ebike.battery_wh')} Wh` : ''],
    [/^(max(imum)? )?range/, e && specValue(bike, 'ebike.range_km') ? `${specValue(bike, 'ebike.range_km')} km` : ''],
    [/^motor (brand|manufacturer)/, e ? specValue(bike, 'ebike.motor_brand') : ''],
    [/^motor (position|location)/, e ? motorPosition(bike) : ''],
    [/^(electric|power assist|e-?bike)/, e ? 'Yes' : ''],
  ];
}

function motorPosition(bike: any): string {
  const m = `${specValue(bike, 'ebike.motor_brand')} ${specValue(bike, 'ebike.motor_model')}`.toLowerCase();
  if (/bosch|shimano|brose|yamaha|fazua|specialized|tq|giant/.test(m)) return 'Mid-Drive';
  if (/hub|bafang|mahle|ebikemotion/.test(m)) return 'Rear Hub';
  return '';
}

const norm = (v: string) =>
  v.toLowerCase().replace(/["”″]/g, 'in').replace(/inch(es)?/g, 'in').replace(/[\s\-_.]/g, '').replace(/centimet(er|re)s?/g, 'cm');

const SIZE_WORDS: Record<string, string> = { xs: 'extra small', s: 'small', m: 'medium', l: 'large', xl: 'extra large', xxl: 'xxl' };

/** Matches a value to one of eBay's choices. Returns null when nothing sensible matches. */
export function matchValue(value: string, choices: string[]): string | null {
  if (!choices.length) return value;
  const v = norm(value);
  const exact = choices.find((c) => norm(c) === v);
  if (exact) return exact;
  // 56 ↔ 56 cm, 700c ↔ 700c/28", M ↔ Medium
  const word = SIZE_WORDS[value.trim().toLowerCase()];
  if (word) {
    const w = choices.find((c) => c.toLowerCase() === word || c.toLowerCase().startsWith(`${word} `) || c.toLowerCase().startsWith(`${word}(`));
    if (w) return w;
  }
  const num = value.match(/\d+(\.\d+)?/)?.[0];
  if (num) {
    const byNum = choices.find((c) => (c.match(/\d+(\.\d+)?/)?.[0]) === num && (c.replace(/[\d.\s]/g, '').length <= 4));
    if (byNum) return byNum;
  }
  const contains = choices.find((c) => norm(c).length > 2 && (v.includes(norm(c)) || norm(c).includes(v)));
  return contains || null;
}

/**
 * Builds the aspects to send. With category metadata, only aspects eBay knows are sent,
 * values are matched for selection-only aspects, and completeness is scored.
 */
export function buildAspects(bike: any, meta: any[], brand: string): AspectResult {
  const cands = candidates(bike, brand);
  const aspects: Record<string, string[]> = {};
  const unmapped: { name: string; value: string }[] = [];
  const missingRequired: string[] = [];
  const missingRecommended: string[] = [];
  let requiredTotal = 0;
  let recommendedTotal = 0;
  let recommendedFilled = 0;

  if (!meta.length) {
    // No category data: send the candidates we have, under their usual names.
    const names = ['Brand', 'Model', 'Bike Type', 'Frame Size', 'Colour', 'Frame Material', 'Wheel Size', 'Number of Gears', 'Brake Type', 'Suspension Type', 'Department', 'Year', 'Handlebar Type', 'Groupset', 'Features'];
    for (const n of names) {
      const hit = cands.find(([re]) => re.test(n.toLowerCase()));
      const val = hit?.[1];
      const list = (Array.isArray(val) ? val : [val]).filter(has).map((x) => String(x).slice(0, 65));
      if (list.length) aspects[n] = list;
    }
    return { aspects, requiredTotal: 0, recommendedTotal: 0, recommendedFilled: 0, missingRequired, missingRecommended, unmapped };
  }

  for (const a of meta) {
    const name = String(a?.localizedAspectName ?? '').trim();
    if (!name) continue;
    const c = a?.aspectConstraint ?? {};
    const required = Boolean(c.aspectRequired);
    const recommended = required || c.aspectUsage === 'RECOMMENDED';
    if (required) requiredTotal++;
    if (recommended) recommendedTotal++;

    const hit = cands.find(([re]) => re.test(name.toLowerCase()));
    const raw = hit?.[1];
    const values = (Array.isArray(raw) ? raw : [raw]).filter(has).map((x) => String(x).trim());
    const selectionOnly = c.aspectMode === 'SELECTION_ONLY';
    const choices: string[] = (a?.aspectValues ?? []).map((v: any) => String(v?.localizedValue ?? '')).filter(Boolean);
    const multi = c.itemToAspectCardinality === 'MULTI';
    const maxLen = Number(c.aspectMaxLength) || 65;

    const out: string[] = [];
    for (const v of values) {
      const m = choices.length ? matchValue(v, choices) : v;
      if (m) out.push(m.slice(0, maxLen));
      else if (!selectionOnly) out.push(v.slice(0, maxLen));
      else unmapped.push({ name, value: v });
      if (!multi && out.length) break;
    }
    if (out.length) {
      aspects[name] = Array.from(new Set(out));
      if (recommended) recommendedFilled++;
    } else {
      if (required) missingRequired.push(name);
      else if (recommended) missingRecommended.push(name);
    }
  }
  return { aspects, requiredTotal, recommendedTotal, recommendedFilled, missingRequired, missingRecommended, unmapped };
}
