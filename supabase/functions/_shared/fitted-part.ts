// The ONE place that decides a fitted part's effective values.
// Rule: per-bike override (bike_components.*) -> library value (components.*).
// Every reader (templates, bike page, break/strip dialogs, eBay, Shopify, Squarespace)
// gets parts through fetchBikeComponents(), which calls resolvePart(). Do not inline
// `bc.x ?? components.x` anywhere else.
// Runtime-agnostic: no imports.

export interface SlotCategory {
  slot: string;
  category_slug: string;
  position: string | null;
  label: string;
  sort_order: number;
}

export interface FittedPart {
  id: string | null;            // bike_components.id
  component_id: string | null;
  slot: string;
  slot_label: string | null;    // from slot_categories
  position: string | null;      // from slot_categories
  notes: string | null;
  brand: string | null;
  model: string | null;
  mpn: string | null;
  weight_g: number | null;
  description: string | null;
  attributes: Record<string, unknown> | null;
  spec_overrides: Record<string, unknown> | null;
  category: string | null;
  /** Which fields came from the per-bike override rather than the library. */
  overridden: string[];
}

const blank = (v: unknown) => v == null || (typeof v === 'string' && v.trim() === '');
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

export function resolvePart(row: any, slotMap: Record<string, SlotCategory> = {}): FittedPart {
  const lib = row?.components ?? {};
  const overridden: string[] = [];
  const pick = (key: 'brand' | 'model' | 'mpn') => {
    if (!blank(row?.[key])) { overridden.push(key); return row[key] as string; }
    return (lib[key] ?? null) as string | null;
  };

  let attributes: Record<string, unknown> | null = isObj(lib.attributes) ? { ...lib.attributes } : null;
  if (isObj(row?.attributes) && Object.keys(row.attributes).length) {
    attributes = { ...(attributes ?? {}), ...row.attributes }; // override keys win
    overridden.push('attributes');
  }

  const sc = slotMap[row?.slot];
  return {
    id: row?.id ?? null,
    component_id: row?.component_id ?? null,
    slot: row?.slot,
    slot_label: sc?.label ?? null,
    position: sc?.position ?? null,
    notes: row?.notes ?? null,
    brand: pick('brand'),
    model: pick('model'),
    mpn: pick('mpn'),
    weight_g: lib.weight_g ?? null,
    description: lib.description ?? null,
    attributes,
    spec_overrides: isObj(row?.spec_overrides) ? row.spec_overrides : null,
    category: lib.component_categories?.name ?? sc?.label ?? null,
    overridden,
  };
}
