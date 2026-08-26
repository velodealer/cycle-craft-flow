/**
 * Bicycle brand/model catalog.
 *
 * Data source: https://github.com/reaatech/bicycle-brands-models (MIT licensed).
 * The brand index is bundled; individual brand files are fetched on demand
 * from the jsDelivr CDN and cached in memory for the session.
 */
import brandIndex from '@/data/bikeBrands.json';

const CDN_BASE = 'https://cdn.jsdelivr.net/gh/reaatech/bicycle-brands-models@main/brands';

export interface CatalogBrand {
  name: string;
  slug: string;
  count: number;
}

export interface CatalogSize {
  size?: string | null;
  frame_size?: number | null;
  rider_height_min?: number | null;
  rider_height_max?: number | null;
  measurement_unit?: string | null;
}

export interface CatalogModel {
  model: string;
  type?: string | null;
  ebike?: boolean | null;
  suspension?: string | null;
  sizes?: CatalogSize[] | null;
}

export const catalogBrands: CatalogBrand[] = (brandIndex as CatalogBrand[]).filter((b) => b.count > 0);

const cache = new Map<string, CatalogModel[]>();

export async function loadBrandModels(slug: string): Promise<CatalogModel[]> {
  const cached = cache.get(slug);
  if (cached) return cached;

  const res = await fetch(`${CDN_BASE}/${slug}.json`);
  if (!res.ok) throw new Error(`Catalog request failed (${res.status})`);
  const data = (await res.json()) as { brand?: string; models?: CatalogModel[] };
  const models = (data.models || []).filter((m) => m && m.model);
  cache.set(slug, models);
  return models;
}

export function formatSizeLabel(size: CatalogSize): string {
  const unit = size.measurement_unit || 'cm';
  const parts: string[] = [];
  if (size.size) parts.push(String(size.size));
  if (size.frame_size) parts.push(`${size.frame_size} ${unit}`);
  const label = parts.join(' — ') || 'Unspecified';
  if (size.rider_height_min && size.rider_height_max) {
    return `${label} (rider ${size.rider_height_min}–${size.rider_height_max} ${unit})`;
  }
  return label;
}

/** Value written into the bike's Size field. */
export function sizeValue(size: CatalogSize): string {
  if (size.size && size.frame_size) return `${size.size} (${size.frame_size}${size.measurement_unit || 'cm'})`;
  if (size.size) return String(size.size);
  if (size.frame_size) return `${size.frame_size}${size.measurement_unit || 'cm'}`;
  return '';
}

export function modelSummary(model: CatalogModel): string {
  const bits: string[] = [];
  if (model.type) bits.push(model.type);
  if (model.ebike) bits.push('eBike');
  if (model.suspension) bits.push(`${model.suspension} suspension`);
  return bits.join(' · ');
}
