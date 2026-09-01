/**
 * 99spokes integration.
 *
 * All API traffic goes through the `spokes-lookup` edge function (the API key
 * never reaches the browser). Bikes that are actually used are saved into our
 * own `catalog_bikes` table so they can be found again instantly, and their
 * components are upserted into the shared `components` library.
 */
import { supabase } from '@/integrations/supabase/client';
import { setAtPath } from '@/lib/bikeSpec';

export interface SpokesSearchItem {
  id: string;
  maker: string;
  model: string;
  family?: string | null;
  year?: number | null;
  category?: string | null;
  subcategory?: string | null;
  isEbike?: boolean;
  isFrameset?: boolean;
  thumbnailUrl?: string | null;
  url?: string | null;
  groupset?: string | null;
  wheelset?: string | null;
  /** Present when the result came from our own saved catalogue. */
  local?: boolean;
  localId?: string;
}

export interface MappedComponent {
  slot: string;
  categorySlug: string;
  brand: string;
  model: string;
  description?: string | null;
  position?: 'front' | 'rear' | null;
}

export interface MappedBike {
  bikeFields: Record<string, any>;
  specValues: Record<string, any>;
  components: MappedComponent[];
  sizes: string[];
  thumbnailUrl?: string | null;
}

/* ------------------------------------------------------------------ API -- */

async function callSpokes<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('spokes-lookup', { body });
  if (error) {
    let details = error.message;
    try {
      const ctx = (error as any).context;
      if (ctx?.text) details = await ctx.text();
    } catch {
      /* ignore */
    }
    throw new Error(details);
  }
  if ((data as any)?.error) throw new Error((data as any).error);
  return data as T;
}

export async function searchSpokes(query: string, limit = 20): Promise<SpokesSearchItem[]> {
  const data = await callSpokes<{ items: SpokesSearchItem[] }>({ action: 'search', query, limit });
  return data.items || [];
}

export async function getSpokesBike(id: string): Promise<any> {
  const data = await callSpokes<{ bike: any }>({ action: 'get', id });
  return data.bike;
}

/* -------------------------------------------------------- local catalogue -- */

export async function searchLocalCatalog(query: string, limit = 10): Promise<SpokesSearchItem[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const { data, error } = await supabase
    .from('catalog_bikes')
    .select('id, source_id, brand, model, family, year, category, subcategory, is_ebike, thumbnail_url, url, components')
    .or(`brand.ilike.%${q}%,model.ilike.%${q}%,family.ilike.%${q}%`)
    .order('use_count', { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data || []).map((r: any) => {
    const comps: MappedComponent[] = Array.isArray(r.components) ? r.components : [];
    const compLabel = (slug: string) => {
      const c = comps.find((x) => x.categorySlug === slug);
      return c ? [c.brand, c.model].filter(Boolean).join(' ') : null;
    };
    return {
    id: r.source_id,
    localId: r.id,
    local: true,
    maker: r.brand,
    model: r.model,
    family: r.family,
    year: r.year,
    category: r.category,
    subcategory: r.subcategory,
      isEbike: r.is_ebike,
      thumbnailUrl: r.thumbnail_url,
      url: r.url,
      groupset: compLabel('rear_derailleur') ?? compLabel('shifters'),
      wheelset: compLabel('wheels'),
    };
  });
}

/** Returns the stored raw 99spokes record if we already have this bike saved. */
export async function getLocalCatalogBike(sourceId: string): Promise<any | null> {
  const { data } = await supabase
    .from('catalog_bikes')
    .select('raw')
    .eq('source', '99spokes')
    .eq('source_id', sourceId)
    .maybeSingle();
  return (data as any)?.raw ?? null;
}

/** Saves (or refreshes) a 99spokes bike in our own catalogue. */
export async function saveCatalogBike(bike: any, mapped: MappedBike): Promise<void> {
  const { data: existing } = await supabase
    .from('catalog_bikes')
    .select('id, use_count')
    .eq('source', '99spokes')
    .eq('source_id', bike.id)
    .maybeSingle();

  const row: any = {
    source: '99spokes',
    source_id: bike.id,
    brand: bike.maker || 'Unknown',
    model: bike.model || 'Unknown',
    family: bike.family ?? null,
    year: bike.year ?? null,
    category: bike.category ?? null,
    subcategory: bike.subcategory ?? null,
    bike_type: mapped.bikeFields.bike_type ?? null,
    is_ebike: !!bike.isEbike,
    thumbnail_url: bike.thumbnailUrl ?? null,
    url: bike.url ?? null,
    sizes: mapped.sizes,
    spec: mapped.specValues,
    bike_fields: mapped.bikeFields,
    components: mapped.components,
    raw: bike,
  };

  if (existing?.id) {
    await supabase
      .from('catalog_bikes')
      .update({ ...row, use_count: (existing as any).use_count + 1 })
      .eq('id', (existing as any).id);
  } else {
    const { data: auth } = await supabase.auth.getUser();
    await supabase.from('catalog_bikes').insert({ ...row, use_count: 1, created_by: auth?.user?.id ?? null });
  }
}

/* ------------------------------------------------------------- component -- */

let categoryCache: Record<string, string> | null = null;

async function categoryIds(): Promise<Record<string, string>> {
  if (categoryCache) return categoryCache;
  const { data } = await supabase.from('component_categories').select('id, slug');
  const map: Record<string, string> = {};
  (data || []).forEach((c: any) => { map[c.slug] = c.id; });
  categoryCache = map;
  return map;
}

/**
 * Upserts the mapped components into the shared components library and links
 * them to a bike. Matching is on category + brand + model so the library grows
 * without duplicating entries.
 */
export async function upsertComponentsForBike(bikeId: string, components: MappedComponent[]): Promise<number> {
  if (!bikeId || components.length === 0) return 0;
  const cats = await categoryIds();
  let linked = 0;

  for (const c of components) {
    const categoryId = cats[c.categorySlug];
    if (!categoryId || !c.brand || !c.model) continue;

    const { data: found } = await supabase
      .from('components')
      .select('id')
      .eq('category_id', categoryId)
      .ilike('brand', c.brand)
      .ilike('model', c.model)
      .maybeSingle();

    let componentId = (found as any)?.id as string | undefined;

    if (!componentId) {
      const { data: created, error } = await supabase
        .from('components')
        .insert({
          category_id: categoryId,
          brand: c.brand,
          model: c.model,
          description: c.description || null,
        })
        .select('id')
        .single();
      if (error || !created) continue;
      componentId = (created as any).id;
    }

    const { error: linkError } = await supabase
      .from('bike_components')
      .upsert(
        { bike_id: bikeId, slot: c.slot, component_id: componentId!, position: c.position || null },
        { onConflict: 'bike_id,slot' },
      );
    if (!linkError) linked += 1;
  }

  return linked;
}

/* ---------------------------------------------------------------- mapper -- */

const MATERIAL_MAP: Record<string, string> = {
  carbon: 'Carbon',
  aluminum: 'Aluminium',
  aluminium: 'Aluminium',
  steel: 'Steel',
  titanium: 'Titanium',
  magnesium: 'Other',
};

const BRAKE_KIND_MAP: Record<string, string> = {
  hydraulicDisc: 'Hydraulic Disc',
  mechanicalDisc: 'Mechanical Disc',
  hydraulicRim: 'Rim',
  rim: 'Rim',
  coaster: 'Rim',
  drum: 'Rim',
};

const GENDER_MAP: Record<string, string> = {
  unisex: 'Unisex',
  womens: 'Female',
  boys: 'Kids',
  girls: 'Kids',
};

/** Maps a 99spokes category/subcategory onto our BIKE_TYPES values. */
export function mapBikeType(bike: any): string | null {
  const sub = bike?.subcategory as string | undefined;
  const cat = bike?.category as string | undefined;
  const fullSus = bike?.suspension?.configuration === 'full';

  if (bike?.isEbike && (cat === 'urban' || sub === 'commuter' || sub === 'utility')) return 'electric';
  switch (sub) {
    case 'gravel': return 'gravel';
    case 'cyclocross': return 'cyclocross';
    case 'triathlon': return 'tt';
    case 'track': return 'track';
    case 'touring': return 'touring';
    case 'folding-bike': return 'folding';
    case 'long-tail-cargo':
    case 'cargo': return 'cargo';
    case 'commuter': return 'hybrid';
    case 'utility': return 'city';
    case 'dirt-jump': return 'bmx';
    default: break;
  }
  switch (cat) {
    case 'mountain': return fullSus ? 'mtb_full_sus' : 'mtb_hardtail';
    case 'road': return 'road';
    case 'urban': return 'hybrid';
    case 'bmx': return 'bmx';
    case 'youth': return 'kids';
    default: return null;
  }
}

function label(part: any): { brand: string; model: string; description?: string } | null {
  if (!part) return null;
  const brand = part.maker || (part.display || part.description || '').split(' ')[0];
  const model = part.model || part.display || part.description;
  if (!brand || !model) return null;
  return { brand: String(brand), model: String(model), description: part.description || part.display || null };
}

function push(list: MappedComponent[], slot: string, categorySlug: string, part: any, position?: 'front' | 'rear') {
  const l = label(part);
  if (!l) return;
  list.push({ slot, categorySlug, brand: l.brand, model: l.model, description: l.description, position: position ?? null });
}

/**
 * Converts a 99spokes bike record into our bike columns, spec_values tree and
 * component list. `sizeName` optionally selects one of the bike's frame sizes.
 */
export function mapSpokesBike(bike: any, sizeName?: string | null): MappedBike {
  const c = bike?.components || {};
  const bikeFields: Record<string, any> = {};
  let spec: Record<string, any> = {};
  const set = (path: string, value: any) => {
    if (value === undefined || value === null || value === '') return;
    spec = setAtPath(spec, path, value);
  };

  /* --- bike columns --- */
  bikeFields.make = bike?.maker || undefined;
  bikeFields.model = [bike?.family, bike?.model].filter(Boolean).join(' ').trim() || bike?.model;
  if (bike?.year) bikeFields.year = bike.year;
  const bikeType = mapBikeType(bike);
  if (bikeType) bikeFields.bike_type = bikeType;
  if (bike?.gender && GENDER_MAP[bike.gender]) bikeFields.gender = GENDER_MAP[bike.gender];
  if (bike?.weight?.weightKG) bikeFields.weight_kg = bike.weight.weightKG;
  const frameMaterial = c.frame?.material ? MATERIAL_MAP[c.frame.material] : undefined;
  if (frameMaterial) bikeFields.frame_material = frameMaterial;
  if (sizeName) bikeFields.size = sizeName;
  if (Array.isArray(bike?.colors) && bike.colors.length === 1) bikeFields.colour = bike.colors[0]?.name;

  bikeFields.is_electric = !!bike?.isEbike;
  bikeFields.has_rear_shock = bike?.suspension?.configuration === 'full';
  bikeFields.has_suspension_fork =
    bike?.suspension?.configuration === 'full' ||
    bike?.suspension?.configuration === 'hardtail' ||
    (bike?.suspension?.front?.isRigid === false);
  bikeFields.has_dropper = c.seatpost?.kind === 'dropper';
  bikeFields.has_accessories = !!(c.fenders || c.racks || c.lights || c.bell || c.stand || c.lock);

  /* --- frame --- */
  set('frame.material', frameMaterial);
  set('frame.size', sizeName || undefined);
  if (c.bottomBracket?.standard) set('frame.bottom_bracket_standard', c.bottomBracket.standard);
  if (c.headset?.display || c.headset?.description) set('frame.headset_standard', c.headset.display || c.headset.description);

  /* --- fork / shock --- */
  set('fork.material', c.fork?.material ? MATERIAL_MAP[c.fork.material] : undefined);
  set('fork.travel_mm', bike?.suspension?.front?.travelMM);
  set('rear_shock.travel_mm', bike?.suspension?.rear?.travelMM);

  /* --- wheels / tyres --- */
  const wheelKind = bike?.wheels?.kinds?.[0];
  set('wheels.wheel_size', wheelKind ? (wheelKind === '700' ? '700c' : `${wheelKind}"`) : undefined);
  set('wheels.rim_material', c.rims?.material ? MATERIAL_MAP[c.rims.material] : undefined);
  set('wheels.internal_width_mm', c.rims?.innerWidthMM);
  set('wheels.hub', c.rearHub?.display || c.rearHub?.description);
  if (c.tires?.width) {
    set('tyres.front_size', c.tires.width);
    set('tyres.rear_size', c.tires.width);
  }

  /* --- drivetrain --- */
  const groupset = c.rearDerailleur?.maker && c.rearDerailleur?.model
    ? `${c.rearDerailleur.maker} ${c.rearDerailleur.model}`
    : c.rearDerailleur?.display;
  set('drivetrain.groupset', groupset);
  set('drivetrain.speed', bike?.gearing?.rear?.count);
  const frontCount = bike?.gearing?.front?.count;
  if (frontCount) set('drivetrain.config', `${frontCount}x`);
  set('drivetrain.chainring', c.crank?.display || c.crank?.description);
  set('drivetrain.cassette_range', c.cassette?.display || c.cassette?.description);

  /* --- brakes --- */
  set('brakes.type', c.brakes?.kind ? BRAKE_KIND_MAP[c.brakes.kind] : undefined);
  const rotor = c.discRotors?.display || c.discRotors?.description;
  if (rotor) {
    const mm = String(rotor).match(/(\d{3})\s?mm/i);
    if (mm) {
      set('brakes.rotor_front_mm', Number(mm[1]));
      set('brakes.rotor_rear_mm', Number(mm[1]));
    }
  }

  /* --- cockpit --- */
  set('cockpit.bar_material', c.handlebar?.material ? MATERIAL_MAP[c.handlebar.material] : undefined);

  /* --- e-bike --- */
  set('ebike.motor_brand', c.motor?.maker);
  set('ebike.motor_model', c.motor?.model || c.motor?.display);
  set('ebike.motor_power_w', c.motor?.powerW);
  set('ebike.torque_nm', c.motor?.torqueNm);
  set('ebike.battery_wh', c.battery?.capacityWh);
  set('ebike.display', c.display?.display || c.display?.description);
  set('ebike.charger', c.charger?.display || c.charger?.description);

  /* --- accessories --- */
  if (c.fenders) set('accessories.mudguards', true);
  if (c.racks) set('accessories.rack', true);
  if (c.lights) set('accessories.lights', true);
  if (c.bell) set('accessories.bell', true);
  if (c.stand) set('accessories.kickstand', true);

  /* --- components library --- */
  const components: MappedComponent[] = [];
  push(components, 'fork', 'fork', c.fork);
  push(components, 'rear_shock', 'rear_shock', c.rearShock);
  push(components, 'wheelset', 'wheels', c.rims);
  push(components, 'front_tyre', 'tyres', c.tires, 'front');
  push(components, 'rear_tyre', 'tyres', c.tires, 'rear');
  push(components, 'crank', 'crank', c.crank);
  push(components, 'cassette', 'cassette', c.cassette);
  push(components, 'chain', 'chain', c.chain);
  push(components, 'front_derailleur', 'front_derailleur', c.frontDerailleur);
  push(components, 'rear_derailleur', 'rear_derailleur', c.rearDerailleur);
  push(components, 'shifters', 'shifters', c.shifters);
  push(components, 'bottom_bracket', 'bottom_bracket', c.bottomBracket);
  push(components, 'brakes', 'brakes', c.brakes);
  push(components, 'handlebars', 'handlebars', c.handlebar);
  push(components, 'stem', 'stem', c.stem);
  push(components, 'grips', 'grips', c.grips);
  push(components, 'saddle', 'saddle', c.saddle);
  push(components, 'seatpost', 'seatpost', c.seatpost);
  push(components, 'pedals', 'pedals', c.pedals);
  push(components, 'ebike_system', 'ebike_system', c.motor);

  const sizes: string[] = Array.isArray(bike?.sizes)
    ? bike.sizes.map((s: any) => s?.name).filter(Boolean)
    : [];

  return { bikeFields, specValues: spec, components, sizes, thumbnailUrl: bike?.thumbnailUrl ?? null };
}

/** Flattens the mapped result into review rows for the retrospective dialog. */
export interface ReviewRow {
  key: string;             // 'bike:size' or 'spec:frame.material'
  label: string;
  incoming: any;
  current: any;
}

export const BIKE_FIELD_LABELS: Record<string, string> = {
  make: 'Make',
  model: 'Model',
  year: 'Year',
  size: 'Size',
  colour: 'Colour',
  bike_type: 'Bike type',
  gender: 'Gender',
  weight_kg: 'Weight (kg)',
  frame_material: 'Frame material',
  is_electric: 'Electric',
  has_rear_shock: 'Rear shock',
  has_suspension_fork: 'Suspension fork',
  has_dropper: 'Dropper post',
  has_accessories: 'Accessories',
};

function flattenSpec(obj: any, prefix = ''): Array<[string, any]> {
  const out: Array<[string, any]> = [];
  Object.entries(obj || {}).forEach(([k, v]) => {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) out.push(...flattenSpec(v, path));
    else out.push([path, v]);
  });
  return out;
}

export function buildReviewRows(mapped: MappedBike, bike: any): ReviewRow[] {
  const rows: ReviewRow[] = [];
  Object.entries(mapped.bikeFields).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return;
    rows.push({
      key: `bike:${k}`,
      label: BIKE_FIELD_LABELS[k] || k,
      incoming: v,
      current: bike?.[k] ?? null,
    });
  });
  flattenSpec(mapped.specValues).forEach(([path, v]) => {
    if (v === undefined || v === null || v === '') return;
    rows.push({
      key: `spec:${path}`,
      label: path.replace(/[._]/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase()),
      incoming: v,
      current: path.split('.').reduce((a: any, k) => (a == null ? undefined : a[k]), bike?.spec_values) ?? null,
    });
  });
  return rows;
}
