// Single source for loading a bike's fitted parts. Used by the edge functions
// (eBay / Shopify / Squarespace publish paths) AND the browser (bike page, dialogs).
// Runtime-agnostic: only a relative import, works under Deno, Vite and Bun.
//
// Contract:
//   - genuinely no parts  -> resolves []
//   - query failed        -> throws PartsFetchError (never degrades to [])
// Values are resolved override -> library by resolvePart() in fitted-part.ts.

import { resolvePart, type FittedPart, type SlotCategory } from './fitted-part.ts';
export { resolvePart, type FittedPart, type SlotCategory } from './fitted-part.ts';

export const BIKE_COMPONENTS_SELECT =
  'id, component_id, slot, notes, brand, model, mpn, attributes, spec_overrides, ' +
  'components(brand, model, mpn, weight_g, description, attributes, component_categories(name))';

export class PartsFetchError extends Error {
  code: string | null;
  constructor(message: string, code: string | null = null) {
    super(message);
    this.name = 'PartsFetchError';
    this.code = code;
  }
}

export function isPartsFetchError(e: unknown): e is PartsFetchError {
  return !!e && (e as any).name === 'PartsFetchError';
}

const fail = (what: string, error: any) =>
  new PartsFetchError(
    `Could not load ${what}: ${error?.message ?? 'unknown error'}${error?.code ? ` (${error.code})` : ''}`,
    error?.code ?? null,
  );

export async function fetchSlotCategories(supabase: any): Promise<Record<string, SlotCategory>> {
  const { data, error } = await supabase.from('slot_categories').select('slot, category_slug, position, label, sort_order');
  if (error) throw fail('slot categories', error);
  const map: Record<string, SlotCategory> = {};
  (data ?? []).forEach((r: SlotCategory) => { map[r.slot] = r; });
  return map;
}

export async function fetchBikeComponents(supabase: any, bikeId: string): Promise<FittedPart[]> {
  if (!bikeId) throw new PartsFetchError('Could not load fitted parts: no bike id');
  const [parts, slotMap] = await Promise.all([
    supabase.from('bike_components').select(BIKE_COMPONENTS_SELECT).eq('bike_id', bikeId),
    fetchSlotCategories(supabase),
  ]);
  if (parts.error) throw fail('fitted parts', parts.error);
  if (!Array.isArray(parts.data)) throw new PartsFetchError('Could not load fitted parts: unexpected response');
  return parts.data.map((row: any) => resolvePart(row, slotMap));
}
