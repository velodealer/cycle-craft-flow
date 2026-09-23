// Single source for loading a bike's fitted parts. Used by the edge functions
// (eBay / Shopify / Squarespace publish paths) AND the browser (bike page copy button).
// Runtime-agnostic: no imports, works under Deno, Vite and Bun.
//
// Contract:
//   - genuinely no parts  -> resolves []
//   - query failed        -> throws PartsFetchError (never degrades to [])

export const BIKE_COMPONENTS_SELECT =
  'slot, notes, components(brand, model, mpn, weight_g, description, attributes, component_categories(name))';

export interface FittedPart {
  slot: string;
  notes: string | null;
  brand: string | null;
  model: string | null;
  mpn: string | null;
  weight_g: number | null;
  description: string | null;
  attributes: Record<string, unknown> | null;
  category: string | null;
}

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

export async function fetchBikeComponents(supabase: any, bikeId: string): Promise<FittedPart[]> {
  if (!bikeId) throw new PartsFetchError('Could not load fitted parts: no bike id');
  const { data, error } = await supabase
    .from('bike_components')
    .select(BIKE_COMPONENTS_SELECT)
    .eq('bike_id', bikeId);
  if (error) {
    throw new PartsFetchError(
      `Could not load fitted parts: ${error.message ?? 'unknown error'}${error.code ? ` (${error.code})` : ''}`,
      error.code ?? null,
    );
  }
  if (!Array.isArray(data)) throw new PartsFetchError('Could not load fitted parts: unexpected response');
  return data.map((row: any) => ({
    slot: row.slot,
    notes: row.notes ?? null,
    brand: row.components?.brand ?? null,
    model: row.components?.model ?? null,
    mpn: row.components?.mpn ?? null,
    weight_g: row.components?.weight_g ?? null,
    description: row.components?.description ?? null,
    attributes: row.components?.attributes ?? null,
    category: row.components?.component_categories?.name ?? null,
  }));
}
