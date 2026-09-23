// Builds eBay listings from VeloDealer bikes and keeps the ebay_listings table in step.
import { ebayFetch, requireConnection, businessIdForBike, itemBase, saveSettings, hasScope, type Client, type Connection } from './ebay.ts';
import { buildEbayTitle, finalEbayTitle } from './ebay-title.ts';
import { buildAspects, type AspectResult } from './ebay-aspects.ts';
import { loadListingTemplate, renderListingHtml, loadBikeComponents } from './listing-template.ts';

export interface BikeRow {
  id: string;
  reference?: string | null;
  make: string;
  model: string;
  year?: number | null;
  size?: string | null;
  colour?: string | null;
  bike_type?: string | null;
  frame_material?: string | null;
  asking_price?: number | null;
  listing_description?: string | null;
  description?: string | null;
  condition?: string | null;
  condition_notes?: string | null;
  mpn?: string | null;
  accessories_included?: string | null;
  photos?: string[] | null;
  frame_number?: string | null;
  gender?: string | null;
  is_electric?: boolean | null;
  spec_values?: Record<string, any> | null;
}

const DEFAULT_CATEGORY = '177831'; // Sporting Goods > Cycling > Bikes
const DEFAULT_LOCATION_KEY = 'velodealer-main';

/** VeloDealer bike types mapped to the values eBay accepts for "Bike Type". */
const EBAY_BIKE_TYPE: Record<string, string> = {
  road: 'Road Bike',
  gravel: 'Gravel Bike',
  mtb_hardtail: 'Mountain Bike',
  mtb_full_sus: 'Mountain Bike',
  bmx: 'BMX',
  hybrid: 'Hybrid Bike',
  city: 'Comfort Bike',
  electric: 'Electric Bike',
  folding: 'Folding Bike',
  cargo: 'Cargo Bike',
  tt: 'Triathlon Bike',
  touring: 'Touring Bike',
  cyclocross: 'Cyclocross Bike',
  track: 'Track Bike',
  tandem: 'Tandem',
  recumbent: 'Recumbent Bike',
  kids: 'Kids Bike',
};

export function ebayBikeType(bike: BikeRow): string | null {
  const raw = String(bike.bike_type ?? '').trim().toLowerCase();
  if (!raw) return null;
  if (EBAY_BIKE_TYPE[raw]) return EBAY_BIKE_TYPE[raw];
  // Fall back to a tidy version of whatever is stored.
  return raw.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function specValue(bike: BikeRow, key: string): string | null {
  const spec = bike.spec_values as any;
  if (!spec || typeof spec !== 'object') return null;
  const direct = spec[key];
  if (typeof direct === 'string' && direct.trim()) return direct.trim();
  for (const group of Object.values(spec)) {
    if (group && typeof group === 'object') {
      const v = (group as any)[key];
      if (typeof v === 'string' && v.trim()) return v.trim();
    }
  }
  return null;
}


function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function bikeTitle(bike: BikeRow): string {
  const title = [bike.make, bike.model, bike.year ? String(bike.year) : '', bike.size ? `${bike.size}` : '']
    .filter(Boolean)
    .join(' ')
    .trim();
  return title.slice(0, 80);
}

export function bikeDescriptionHtml(bike: BikeRow): string {
  const text = bike.listing_description || bike.description || '';
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
    .join('');
  const specs: Array<[string, unknown]> = [
    ['Frame size', bike.size],
    ['Colour', bike.colour],
    ['Type', bike.bike_type],
    ['Frame material', bike.frame_material],
    ['Condition', bike.condition],
    ['Included', bike.accessories_included],
  ];
  const rows = specs
    .filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== '')
    .map(([k, v]) => `<li><strong>${escapeHtml(k)}:</strong> ${escapeHtml(v)}</li>`)
    .join('');
  return `${paragraphs}${rows ? `<ul>${rows}</ul>` : ''}` || `<p>${escapeHtml(bikeTitle(bike))}</p>`;
}

/**
 * The inventory item's product.description is capped at 4,000 characters by eBay
 * (the offer's listingDescription allows 500,000 and carries the real listing copy).
 * Produce a short plain-text summary that always fits.
 */
export function inventorySummary(bike: BikeRow): string {
  const raw = (bike.listing_description || bike.description || '').toString();
  const text = raw
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim() || bikeTitle(bike);
  const LIMIT = 3900;
  if (text.length <= LIMIT) return text;
  const cut = text.slice(0, LIMIT);
  const boundary = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  return (boundary > 500 ? cut.slice(0, boundary + 1) : cut.replace(/\s+\S*$/, '')).trim() + '…';
}

const CATEGORY_TREE_ID: Record<string, string> = {
  EBAY_GB: '3',
  EBAY_US: '0',
  EBAY_AU: '15',
  EBAY_IE: '205',
  EBAY_CA: '2',
  EBAY_DE: '77',
  EBAY_FR: '71',
  EBAY_IT: '101',
  EBAY_ES: '186',
};

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/** Reads a category lookup from the 24-hour cache, fetching and storing it when stale. */
async function cachedCategoryData<T>(
  supabase: Client,
  conn: Connection,
  categoryId: string,
  kind: string,
  fetcher: () => Promise<T>,
): Promise<T> {
  const marketplace = conn.settings.marketplace_id || 'EBAY_GB';
  const cacheKey = `${conn.environment}:${marketplace}`;
  try {
    const { data } = await supabase
      .from('ebay_category_cache')
      .select('payload, fetched_at')
      .eq('marketplace_id', cacheKey)
      .eq('category_id', categoryId)
      .eq('kind', kind)
      .maybeSingle();
    if (data && Date.now() - Date.parse((data as any).fetched_at) < CACHE_TTL_MS) {
      return (data as any).payload as T;
    }
  } catch { /* fetch fresh */ }
  const fresh = await fetcher();
  await supabase.from('ebay_category_cache').upsert({
    marketplace_id: cacheKey,
    category_id: categoryId,
    kind,
    payload: fresh as any,
    fetched_at: new Date().toISOString(),
  }, { onConflict: 'marketplace_id,category_id,kind' });
  return fresh;
}

/** The category's item specifics metadata (cached). Empty when the lookup fails. */
async function categoryAspects(supabase: Client, conn: Connection, categoryId: string): Promise<any[]> {
  const treeId = CATEGORY_TREE_ID[conn.settings.marketplace_id || 'EBAY_GB'] || '3';
  try {
    return await cachedCategoryData(supabase, conn, categoryId, 'aspects', async () => {
      const data = await ebayFetch<any>(
        conn,
        `/commerce/taxonomy/v1/category_tree/${treeId}/get_item_aspects_for_category?category_id=${encodeURIComponent(categoryId)}`,
      );
      return (data?.aspects ?? []) as any[];
    });
  } catch (e) {
    console.warn('Could not read eBay item specifics:', (e as Error).message);
    return [];
  }
}

/** Matches the bike's brand to eBay's spelling when the category offers a brand list. */
function normaliseBrand(meta: any[], brand: string): string {
  const clean = String(brand ?? '').trim().replace(/\s+/g, ' ');
  const brandAspect = meta.find((a: any) => String(a?.localizedAspectName).toLowerCase() === 'brand');
  const values: string[] = (brandAspect?.aspectValues ?? []).map((v: any) => String(v?.localizedValue ?? ''));
  const match = values.find((v) => v.toLowerCase() === clean.toLowerCase());
  return match || clean;
}

/** eBay condition enums and their numeric ids. */
const CONDITION_ID: Record<string, string> = {
  NEW: '1000',
  LIKE_NEW: '2750',
  NEW_OTHER: '1500',
  NEW_WITH_DEFECTS: '1750',
  USED_EXCELLENT: '3000',
  USED_VERY_GOOD: '4000',
  USED_GOOD: '5000',
  USED_ACCEPTABLE: '6000',
  FOR_PARTS_OR_NOT_WORKING: '7000',
};

/** Best condition first. We never swap to a condition better than the one chosen. */
const CONDITION_RANK: Record<string, number> = {
  NEW: 0,
  LIKE_NEW: 1,
  NEW_OTHER: 2,
  NEW_WITH_DEFECTS: 3,
  USED_EXCELLENT: 4,
  USED_VERY_GOOD: 5,
  USED_GOOD: 6,
  USED_ACCEPTABLE: 7,
  FOR_PARTS_OR_NOT_WORKING: 8,
};

const CONDITION_LABEL: Record<string, string> = {
  NEW: 'New',
  LIKE_NEW: 'Like new',
  NEW_OTHER: 'New (other)',
  NEW_WITH_DEFECTS: 'New with defects',
  USED_EXCELLENT: 'Used – excellent',
  USED_VERY_GOOD: 'Used – very good',
  USED_GOOD: 'Used – good',
  USED_ACCEPTABLE: 'Used – acceptable',
  FOR_PARTS_OR_NOT_WORKING: 'For parts or not working',
};
export const conditionLabel = (c: string) => CONDITION_LABEL[c] || c;

/** Where to fall back to when a category doesn't accept the chosen condition (never better). */
const CONDITION_FALLBACK: Record<string, string[]> = {
  NEW: ['NEW', 'LIKE_NEW', 'NEW_OTHER', 'NEW_WITH_DEFECTS', 'USED_EXCELLENT'],
  LIKE_NEW: ['LIKE_NEW', 'NEW_OTHER', 'NEW_WITH_DEFECTS', 'USED_EXCELLENT'],
  NEW_OTHER: ['NEW_OTHER', 'NEW_WITH_DEFECTS', 'USED_EXCELLENT'],
  NEW_WITH_DEFECTS: ['NEW_WITH_DEFECTS', 'USED_EXCELLENT', 'USED_VERY_GOOD'],
  USED_EXCELLENT: ['USED_EXCELLENT', 'USED_VERY_GOOD', 'USED_GOOD', 'USED_ACCEPTABLE'],
  USED_VERY_GOOD: ['USED_VERY_GOOD', 'USED_GOOD', 'USED_ACCEPTABLE'],
  USED_GOOD: ['USED_GOOD', 'USED_ACCEPTABLE'],
  USED_ACCEPTABLE: ['USED_ACCEPTABLE', 'FOR_PARTS_OR_NOT_WORKING'],
  FOR_PARTS_OR_NOT_WORKING: ['FOR_PARTS_OR_NOT_WORKING'],
};

/** Condition ids a category accepts (cached). Null when the lookup fails (then we don't second-guess). */
async function allowedConditionIds(supabase: Client, conn: Connection, categoryId: string): Promise<Set<string> | null> {
  const marketplace = conn.settings.marketplace_id || 'EBAY_GB';
  try {
    const ids = await cachedCategoryData<string[] | null>(supabase, conn, categoryId, 'conditions', async () => {
      const data = await ebayFetch<any>(
        conn,
        `/sell/metadata/v1/marketplace/${marketplace}/get_item_condition_policies?filter=categoryIds:%7B${encodeURIComponent(categoryId)}%7D`,
      );
      const policy = (data?.itemConditionPolicies ?? [])[0];
      if (!policy) return null;
      const list = (policy.itemConditions ?? [])
        .map((c: any) => String(c?.conditionId || '').trim())
        .filter(Boolean);
      return list.length ? list : null;
    });
    return ids && ids.length ? new Set<string>(ids) : null;
  } catch (e) {
    console.warn('Could not read eBay condition policy:', (e as Error).message);
    return null;
  }
}

/**
 * Picks a condition the category accepts, as close as possible to the chosen one and never better.
 * Throws when the only accepted conditions would describe the bike as better than it is.
 */
async function resolveCondition(
  supabase: Client,
  conn: Connection,
  categoryId: string,
  wanted: string,
): Promise<{ condition: string; substituted: boolean }> {
  const allowed = await allowedConditionIds(supabase, conn, categoryId);
  if (!allowed) return { condition: wanted, substituted: false };
  const ok = (c: string) => CONDITION_ID[c] && allowed.has(CONDITION_ID[c]);
  if (ok(wanted)) return { condition: wanted, substituted: false };
  const wantedRank = CONDITION_RANK[wanted] ?? 99;
  const candidates = [
    ...(CONDITION_FALLBACK[wanted] ?? []),
    ...Object.keys(CONDITION_ID).sort((a, b) => CONDITION_RANK[a] - CONDITION_RANK[b]),
  ];
  for (const candidate of candidates) {
    if ((CONDITION_RANK[candidate] ?? -1) < wantedRank) continue;
    if (ok(candidate)) {
      console.log(`eBay category ${categoryId} rejects ${wanted}; using ${candidate}.`);
      return { condition: candidate, substituted: true };
    }
  }
  throw new Error(
    `This eBay category doesn't accept "${conditionLabel(wanted)}", and the only conditions it allows would describe the bike as better than it is. Pick a different category or condition for this bike.`,
  );
}

/** Plain text, at most 1,000 characters, cut at a sentence end. */
function conditionDescription(notes: string | null | undefined, grade: number | null): string {
  const text = String(notes ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const prefix = grade != null ? `InspectABike grade: ${grade}/5. ` : '';
  const full = `${prefix}${text}`.trim();
  const LIMIT = 1000;
  if (full.length <= LIMIT) return full;
  const cut = full.slice(0, LIMIT - 1);
  const boundary = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  return (boundary > 200 ? cut.slice(0, boundary + 1) : cut.replace(/\s+\S*$/, '') + '…').trim();
}


function skuFor(bike: BikeRow) {
  return String(bike.reference || bike.id).replace(/[^A-Za-z0-9._-]/g, '-').slice(0, 50);
}

async function upsertListing(supabase: Client, bikeId: string, patch: Record<string, unknown>) {
  const { data: bikeRow } = await supabase
    .from('bikes')
    .select('business_id')
    .eq('id', bikeId)
    .maybeSingle();
  const { error } = await supabase
    .from('ebay_listings')
    .upsert(
      { bike_id: bikeId, business_id: (bikeRow as any)?.business_id ?? null, ...patch, updated_at: new Date().toISOString() },
      { onConflict: 'bike_id' },
    );
  if (error) console.error('ebay_listings upsert failed:', error.message);
}

export const LOCATION_MISSING_MESSAGE =
  'Set your despatch location (town and postcode) in Settings → Integrations → eBay first.';

async function businessName(supabase: Client, businessId: string): Promise<string> {
  const { data } = await supabase.from('businesses').select('name').eq('id', businessId).maybeSingle();
  return String((data as any)?.name || '').trim();
}

/**
 * Makes sure the dealer's despatch location exists on eBay and matches their settings.
 * Creates it when missing and updates it when the address or name has changed.
 */
export async function ensureLocation(supabase: Client, conn: Connection, businessId: string): Promise<string> {
  const s = conn.settings;
  const postcode = String(s.postcode ?? '').trim();
  const city = String(s.city ?? '').trim();
  if (!postcode || !city) throw new Error(LOCATION_MISSING_MESSAGE);

  const key = s.merchant_location_key || DEFAULT_LOCATION_KEY;
  const name = (String(s.location_name ?? '').trim() || (await businessName(supabase, businessId)) || 'Despatch location').slice(0, 1000);
  const address: Record<string, string> = {
    country: (s.country || 'GB').toUpperCase(),
    postalCode: postcode,
    city,
  };
  if (s.address_line1?.trim()) address.addressLine1 = s.address_line1.trim();

  let current: any = null;
  try {
    current = await ebayFetch<any>(conn, `/sell/inventory/v1/location/${encodeURIComponent(key)}`);
  } catch { /* create below */ }

  if (!current) {
    await ebayFetch(conn, `/sell/inventory/v1/location/${encodeURIComponent(key)}`, {
      method: 'POST',
      body: JSON.stringify({
        location: { address },
        locationInstructions: 'Collection and despatch point',
        name,
        merchantLocationStatus: 'ENABLED',
        locationTypes: ['WAREHOUSE'],
      }),
    });
    return key;
  }

  const held = current?.location?.address ?? {};
  const norm = (v: unknown) => String(v ?? '').replace(/\s+/g, '').toLowerCase();
  const differs =
    norm(held.postalCode) !== norm(address.postalCode) ||
    norm(held.city) !== norm(address.city) ||
    norm(held.addressLine1) !== norm(address.addressLine1) ||
    norm(held.country) !== norm(address.country) ||
    String(current?.name ?? '') !== name;
  if (differs) {
    await ebayFetch(conn, `/sell/inventory/v1/location/${encodeURIComponent(key)}/update_location_details`, {
      method: 'POST',
      body: JSON.stringify({
        location: { address },
        locationInstructions: 'Collection and despatch point',
        name,
      }),
    });
  }
  return key;
}

/** The address eBay currently holds for the dealer's despatch location, or null. */
export async function heldLocation(conn: Connection): Promise<{ city: string | null; postcode: string | null } | null> {
  const key = conn.settings.merchant_location_key || DEFAULT_LOCATION_KEY;
  try {
    const current = await ebayFetch<any>(conn, `/sell/inventory/v1/location/${encodeURIComponent(key)}`);
    const a = current?.location?.address ?? {};
    return { city: a.city ?? null, postcode: a.postalCode ?? null };
  } catch {
    return null;
  }
}

async function findOfferId(conn: Connection, sku: string): Promise<string | null> {
  try {
    const data = await ebayFetch<any>(
      conn,
      `/sell/inventory/v1/offer?sku=${encodeURIComponent(sku)}`,
    );
    return data?.offers?.[0]?.offerId ?? null;
  } catch {
    return null;
  }
}

// ---------- Photos ----------

/** Reads width/height from the first bytes of a JPEG, PNG or WebP. */
function imageSize(buf: Uint8Array): { w: number; h: number } | null {
  if (buf[0] === 0x89 && buf[1] === 0x50) {
    const dv = new DataView(buf.buffer, buf.byteOffset);
    return { w: dv.getUint32(16), h: dv.getUint32(20) };
  }
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) { i++; continue; }
      const marker = buf[i + 1];
      const len = (buf[i + 2] << 8) | buf[i + 3];
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { h: (buf[i + 5] << 8) | buf[i + 6], w: (buf[i + 7] << 8) | buf[i + 8] };
      }
      i += 2 + len;
    }
    return null;
  }
  if (buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) {
    const fmt = String.fromCharCode(buf[12], buf[13], buf[14], buf[15]);
    if (fmt === 'VP8X') return { w: 1 + (buf[24] | (buf[25] << 8) | (buf[26] << 16)), h: 1 + (buf[27] | (buf[28] << 8) | (buf[29] << 16)) };
    if (fmt === 'VP8 ') return { w: (buf[26] | (buf[27] << 8)) & 0x3fff, h: (buf[28] | (buf[29] << 8)) & 0x3fff };
    if (fmt === 'VP8L') {
      const b = buf.slice(21, 25);
      return { w: 1 + (((b[1] & 0x3f) << 8) | b[0]), h: 1 + (((b[3] & 0xf) << 10) | (b[2] << 2) | ((b[1] & 0xc0) >> 6)) };
    }
  }
  return null;
}

/** Longest side of each photo in pixels (null when unknown). Cached per address. */
async function photoSizes(supabase: Client, urls: string[]): Promise<Record<string, number | null>> {
  const out: Record<string, number | null> = {};
  if (!urls.length) return out;
  const { data } = await supabase
    .from('ebay_category_cache')
    .select('category_id, payload')
    .eq('marketplace_id', 'photo')
    .eq('kind', 'size')
    .in('category_id', urls);
  for (const r of (data ?? []) as any[]) out[r.category_id] = r.payload?.longest ?? null;
  const todo = urls.filter((u) => !(u in out));
  await Promise.all(todo.map(async (url) => {
    let longest: number | null = null;
    try {
      const res = await fetch(url, { headers: { Range: 'bytes=0-131071' } });
      if (res.ok || res.status === 206) {
        const size = imageSize(new Uint8Array(await res.arrayBuffer()));
        if (size) longest = Math.max(size.w, size.h);
      }
    } catch { /* unknown */ }
    out[url] = longest;
    if (longest) {
      await supabase.from('ebay_category_cache').upsert({
        marketplace_id: 'photo', category_id: url, kind: 'size', payload: { longest }, fetched_at: new Date().toISOString(),
      }, { onConflict: 'marketplace_id,category_id,kind' });
    }
  }));
  return out;
}

// ---------- Preparation (shared by preview and publish) ----------

export type CheckLevel = 'ok' | 'warn' | 'block';
export interface CheckItem { key: string; level: CheckLevel; label: string; detail?: string }

export interface PreparedListing {
  conn: Connection;
  businessId: string;
  existing: any;
  sku: string;
  title: string;
  builtTitle: string;
  titleFormat: string | null;
  categoryId: string;
  categorySource: 'bike' | 'type' | 'default';
  wantedCondition: string;
  condition: string | null;
  substituted: boolean;
  conditionError: string | null;
  conditionDescription: string;
  brand: string;
  aspectResult: AspectResult;
  images: string[];
  photoSizes: Record<string, number | null>;
  descriptionHtml: string;
  mobilePreview: string;
  bestOffer: { enabled: boolean; accept: number | null; decline: number | null };
  promotion: { enabled: boolean; rate: number | null; available: boolean };
  checklist: CheckItem[];
  warnings: string[];
}

export async function prepareListing(supabase: Client, bike: BikeRow): Promise<PreparedListing> {
  const businessId = await businessIdForBike(supabase, bike.id);
  const conn = await requireConnection(supabase, businessId);
  const s = conn.settings;
  const checklist: CheckItem[] = [];
  const warnings: string[] = [];
  const add = (key: string, level: CheckLevel, label: string, detail?: string) => checklist.push({ key, level, label, detail });

  const { data: existing, error: existingErr } = await supabase.from('ebay_listings').select('*').eq('bike_id', bike.id).maybeSingle();
  // A failed read must not look like "never listed" — that would create a duplicate offer.
  if (existingErr) throw new Error(`Could not load the existing eBay listing: ${existingErr.message}`);
  const ex = (existing ?? {}) as any;

  // Description from the dealer's listing format.
  let descriptionHtml = bikeDescriptionHtml(bike);
  let titleFormat: string | null = null;
  // Data loads must fail loudly: a failed fetch is NOT the same as "no parts" / "no format".
  const tpl = await loadListingTemplate(supabase, 'ebay', businessId);
  const { data: fmtRow, error: fmtErr } = await supabase
    .from('listing_templates').select('title_format, business_id').eq('platform', 'ebay');
  if (fmtErr) throw new Error(`Could not load the eBay title format: ${fmtErr.message}`);
  const rows = (fmtRow ?? []) as any[];
  titleFormat = (rows.find((r) => r.business_id === businessId) ?? rows.find((r) => !r.business_id))?.title_format ?? null;
  if (tpl) {
    const components = await loadBikeComponents(supabase, bike.id);
    try {
      descriptionHtml = renderListingHtml(tpl, bike, components) || descriptionHtml;
    } catch (e) {
      console.error('listing template render failed, using default description:', (e as Error).message);
    }
  }
  const mobilePreview = descriptionHtml
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 800);

  // Title
  const builtTitle = buildEbayTitle(bike, titleFormat);
  const title = finalEbayTitle(bike, titleFormat, ex.title_override);
  add('title', title.length >= 40 ? 'ok' : 'warn', `Title ${title.length}/80`, title.length < 40 ? 'Short titles are found less often — add groupset, material or size.' : title);

  // Basics that stop a listing
  const policiesOk = Boolean(s.fulfillment_policy_id && s.payment_policy_id && s.return_policy_id);
  add('policies', policiesOk ? 'ok' : 'block', policiesOk ? 'Postage, payment and returns policies set' : 'Choose postage, payment and returns policies in Settings → Integrations');
  const priceOk = bike.asking_price != null && Number(bike.asking_price) > 0;
  add('price', priceOk ? 'ok' : 'block', priceOk ? `Asking price £${Number(bike.asking_price).toLocaleString('en-GB')}` : 'Set an asking price');
  add('type', bike.bike_type ? 'ok' : 'block', bike.bike_type ? `Bike type: ${ebayBikeType(bike)}` : 'Add a bike type');
  const locationOk = Boolean(String(s.postcode ?? '').trim() && String(s.city ?? '').trim());
  add('location', locationOk ? 'ok' : 'block', locationOk ? `Despatch from ${s.city}, ${s.postcode}` : LOCATION_MISSING_MESSAGE);

  // Category: bike → bike type → default
  let categorySource: 'bike' | 'type' | 'default' = 'default';
  let categoryId = s.category_id || DEFAULT_CATEGORY;
  const byType = s.category_by_type?.[String(bike.bike_type ?? '')];
  if (ex.category_id) { categoryId = ex.category_id; categorySource = 'bike'; }
  else if (byType) { categoryId = byType; categorySource = 'type'; }
  add('category', 'ok', `Category ${categoryId}`, categorySource === 'bike' ? 'Chosen for this bike' : categorySource === 'type' ? 'From your bike-type categories' : 'Account default');

  // Condition
  const wantedCondition = ex.condition || s.condition || 'USED_EXCELLENT';
  let condition: string | null = null;
  let substituted = false;
  let conditionError: string | null = null;
  try {
    const r = await resolveCondition(supabase, conn, categoryId, wantedCondition);
    condition = r.condition;
    substituted = r.substituted;
  } catch (e) {
    conditionError = (e as Error).message;
  }
  if (conditionError) add('condition', 'block', conditionError);
  else if (substituted) {
    add('condition', 'warn', `Condition will be "${conditionLabel(condition!)}"`, `eBay doesn't accept "${conditionLabel(wantedCondition)}" in this category.`);
    warnings.push(`eBay doesn't accept "${conditionLabel(wantedCondition)}" in this category, so it was listed as "${conditionLabel(condition!)}".`);
  } else add('condition', 'ok', `Condition: ${conditionLabel(condition!)}`);

  // Condition notes, led by the InspectABike grade.
  const { data: inspection } = await supabase
    .from('inspections').select('overall_grade').eq('bike_id', bike.id)
    .not('overall_grade', 'is', null).order('created_at', { ascending: false }).limit(1).maybeSingle();
  const grade = (inspection as any)?.overall_grade != null ? Number((inspection as any).overall_grade) : null;
  const condDesc = conditionDescription(bike.condition_notes, grade);
  if (!String(bike.condition_notes ?? '').trim()) {
    add('condition_notes', 'warn', 'No condition notes', 'Used bikes sell better and get fewer disputes with condition notes.');
    warnings.push('Used bikes sell better and get fewer disputes with condition notes.');
  } else add('condition_notes', 'ok', 'Condition notes added');

  // Item specifics
  const meta = await categoryAspects(supabase, conn, categoryId);
  const brand = normaliseBrand(meta, bike.make);
  const aspectResult = buildAspects(bike, meta, brand);
  if (aspectResult.missingRequired.length) {
    add('specifics_required', 'block', `Missing required item specifics: ${aspectResult.missingRequired.join(', ')}`);
  }
  if (aspectResult.recommendedTotal) {
    const { recommendedFilled: f, recommendedTotal: t } = aspectResult;
    add('specifics', f / t >= 0.7 ? 'ok' : 'warn', `Item specifics: ${f}/${t} recommended filled`,
      aspectResult.missingRecommended.length ? `Missing: ${aspectResult.missingRecommended.slice(0, 12).join(', ')}` : undefined);
  }
  if (aspectResult.unmapped.length) {
    add('specifics_unmapped', 'warn', "Couldn't match to eBay's choices",
      aspectResult.unmapped.map((u) => `${u.name}: ${u.value}`).join('; '));
  }

  // Photos: up to 24, gallery photo first
  let photos = (bike.photos ?? []).filter((u) => typeof u === 'string' && /^https?:\/\//.test(u));
  const gi = Number.isInteger(ex.gallery_photo_index) ? ex.gallery_photo_index : 0;
  if (gi > 0 && gi < photos.length) photos = [photos[gi], ...photos.filter((_, i) => i !== gi)];
  const images = photos.slice(0, 24);
  const sizes = await photoSizes(supabase, images);
  const tiny = images.filter((u) => sizes[u] != null && sizes[u]! < 500);
  const small = images.filter((u) => sizes[u] != null && sizes[u]! >= 500 && sizes[u]! < 1600);
  if (!images.length) add('photos', 'block', 'Add at least one photo');
  else if (tiny.length) add('photos', 'block', `${tiny.length} photo(s) are under 500px — eBay rejects these`);
  else if (images.length < 6 || small.length) {
    add('photos', 'warn', `${images.length} photo(s)`, [images.length < 6 ? 'Listings with 6+ photos sell faster' : '', small.length ? `${small.length} under 1600px (no zoom on eBay)` : ''].filter(Boolean).join('. '));
  } else add('photos', 'ok', `${images.length} photos`);

  // Best Offer
  const boEnabled = ex.best_offer_enabled ?? s.best_offer_enabled ?? false;
  const acceptPct = s.best_offer_accept_pct ?? 95;
  const declinePct = s.best_offer_decline_pct ?? 80;
  const price = Number(bike.asking_price) || 0;
  const bestOffer = {
    enabled: Boolean(boEnabled),
    accept: boEnabled && acceptPct ? Math.round(price * acceptPct) / 100 : null,
    decline: boEnabled && declinePct ? Math.round(price * declinePct) / 100 : null,
  };
  add('best_offer', 'ok', bestOffer.enabled ? 'Best Offer on' : 'Best Offer off');

  // Promotion
  const promoAvailable = hasScope(s, 'sell.marketing');
  const promoRate = ex.ad_rate ?? (s.promote_enabled && s.promote_auto ? s.ad_rate ?? null : null);
  const promotion = { enabled: Boolean(s.promote_enabled && promoRate), rate: promoRate != null ? Number(promoRate) : null, available: promoAvailable };
  if (promotion.enabled && !promoAvailable) add('promotion', 'warn', 'Promotion needs eBay reconnecting', 'Reconnect eBay in Settings to allow Promoted Listings.');
  else add('promotion', 'ok', promotion.enabled ? `Promoted at ${promotion.rate}%` : 'Not promoted');

  add('mobile', mobilePreview.length >= 200 ? 'ok' : 'warn', 'Mobile description preview', mobilePreview || 'Empty — buyers on the eBay app see nothing.');

  return {
    conn, businessId, existing, sku: skuFor(bike), title, builtTitle, titleFormat, categoryId, categorySource,
    wantedCondition, condition, substituted, conditionError, conditionDescription: condDesc, brand, aspectResult,
    images, photoSizes: sizes, descriptionHtml, mobilePreview, bestOffer, promotion, checklist, warnings,
  };
}

/** Creates or reuses the dealer's "VeloDealer auto" campaign. */
async function ensureCampaign(supabase: Client, conn: Connection, businessId: string): Promise<string> {
  if (conn.settings.campaign_id) return conn.settings.campaign_id;
  const name = 'VeloDealer auto';
  const find = async () => {
    try {
      const found = await ebayFetch<any>(conn, `/sell/marketing/v1/ad_campaign/get_campaign_by_name?campaign_name=${encodeURIComponent(name)}`);
      return found?.campaignId as string | undefined;
    } catch { return undefined; }
  };
  let id = await find();
  if (!id) {
    await ebayFetch(conn, '/sell/marketing/v1/ad_campaign', {
      method: 'POST',
      body: JSON.stringify({
        campaignName: name,
        marketplaceId: conn.settings.marketplace_id || 'EBAY_GB',
        startDate: new Date(Date.now() + 60_000).toISOString(),
        fundingStrategy: { fundingModel: 'COST_PER_SALE', bidPercentage: String(conn.settings.ad_rate ?? 5) },
      }),
    });
    id = await find();
  }
  if (!id) throw new Error('eBay did not return the promotion campaign.');
  await saveSettings(supabase, businessId, { campaign_id: id });
  return id;
}

async function removeAd(conn: Connection, listing: any) {
  if (!listing?.ad_id || !conn.settings.campaign_id) return;
  try {
    await ebayFetch(conn, `/sell/marketing/v1/ad_campaign/${conn.settings.campaign_id}/ad/${listing.ad_id}`, { method: 'DELETE' });
  } catch (e) {
    console.warn('Could not remove eBay ad:', (e as Error).message);
  }
}

/** Creates or updates the eBay listing for a bike and publishes it. */
export async function pushBikeToEbay(
  supabase: Client,
  bike: BikeRow,
): Promise<{ offerId: string; listingId: string | null; url: string | null; warnings: string[]; substitution: { from: string; to: string } | null }> {
  const p = await prepareListing(supabase, bike);
  const blockers = p.checklist.filter((c) => c.level === 'block');
  if (blockers.length) throw new Error(blockers.map((b) => b.label).join('. ') + '.');
  const { conn, businessId, sku } = p;
  const s = conn.settings;
  const warnings = [...p.warnings];
  const locationKey = await ensureLocation(supabase, conn, businessId);

  const product: Record<string, unknown> = {
    title: p.title,
    description: inventorySummary(bike),
    imageUrls: p.images,
    aspects: p.aspectResult.aspects,
    brand: p.brand,
  };
  const mpn = String(bike.mpn ?? '').trim();
  if (mpn) product.mpn = mpn.slice(0, 65);

  const inventoryBody: Record<string, unknown> = {
    availability: { shipToLocationAvailability: { quantity: 1 } },
    condition: p.condition,
    product,
  };
  if (p.conditionDescription && p.condition !== 'NEW') inventoryBody.conditionDescription = p.conditionDescription;

  await ebayFetch(conn, `/sell/inventory/v1/inventory_item/${encodeURIComponent(sku)}`, {
    method: 'PUT',
    body: JSON.stringify(inventoryBody),
  });

  let offerId = (p.existing?.offer_id as string | undefined) || (await findOfferId(conn, sku));
  const currency = s.currency || 'GBP';
  const listingPolicies: Record<string, unknown> = {
    fulfillmentPolicyId: s.fulfillment_policy_id,
    paymentPolicyId: s.payment_policy_id,
    returnPolicyId: s.return_policy_id,
  };
  if (p.bestOffer.enabled) {
    const terms: Record<string, unknown> = { bestOfferEnabled: true };
    if (p.bestOffer.accept) terms.autoAcceptPrice = { value: p.bestOffer.accept.toFixed(2), currency };
    if (p.bestOffer.decline) terms.autoDeclinePrice = { value: p.bestOffer.decline.toFixed(2), currency };
    listingPolicies.bestOfferTerms = terms;
  } else {
    listingPolicies.bestOfferTerms = { bestOfferEnabled: false };
  }
  const offerBody = {
    sku,
    marketplaceId: s.marketplace_id || 'EBAY_GB',
    format: 'FIXED_PRICE',
    availableQuantity: 1,
    categoryId: p.categoryId,
    listingDescription: p.descriptionHtml,
    merchantLocationKey: locationKey,
    listingPolicies,
    pricingSummary: { price: { value: String(bike.asking_price), currency } },
  };

  if (offerId) {
    await ebayFetch(conn, `/sell/inventory/v1/offer/${offerId}`, { method: 'PUT', body: JSON.stringify(offerBody) });
  } else {
    const created = await ebayFetch<any>(conn, '/sell/inventory/v1/offer', { method: 'POST', body: JSON.stringify(offerBody) });
    offerId = created?.offerId as string;
  }

  let listingId = (p.existing?.listing_id as string | null) ?? null;
  try {
    const published = await ebayFetch<any>(conn, `/sell/inventory/v1/offer/${offerId}/publish`, { method: 'POST', body: JSON.stringify({}) });
    listingId = published?.listingId ?? listingId;
  } catch (e) {
    if (!/already published/i.test((e as Error).message)) throw e;
  }
  const url = listingId ? `${itemBase(conn.environment)}${listingId}` : null;

  // Promoted Listings — never blocks the listing itself.
  let adId: string | null = p.existing?.ad_id ?? null;
  if (listingId && p.promotion.enabled && p.promotion.available) {
    try {
      const campaignId = await ensureCampaign(supabase, conn, businessId);
      const rate = String(p.promotion.rate);
      if (adId) {
        await ebayFetch(conn, `/sell/marketing/v1/ad_campaign/${campaignId}/ad/${adId}/update_bid`, {
          method: 'POST', body: JSON.stringify({ bidPercentage: rate }),
        }).catch(() => undefined);
      } else {
        await ebayFetch(conn, `/sell/marketing/v1/ad_campaign/${campaignId}/ad`, {
          method: 'POST', body: JSON.stringify({ listingId, bidPercentage: rate }),
        }).catch((e) => { if (!/already/i.test((e as Error).message)) throw e; });
        const ads = await ebayFetch<any>(conn, `/sell/marketing/v1/ad_campaign/${campaignId}/ad?listing_ids=${listingId}`);
        adId = ads?.ads?.[0]?.adId ?? null;
      }
    } catch (e) {
      warnings.push(`Listed, but promotion failed: ${(e as Error).message}`);
    }
  } else if (adId && !p.promotion.enabled) {
    await removeAd(conn, p.existing);
    adId = null;
  }

  await upsertListing(supabase, bike.id, {
    environment: conn.environment,
    sku,
    offer_id: offerId,
    listing_id: listingId,
    listing_url: url,
    status: 'listed',
    quantity: 1,
    last_synced_at: new Date().toISOString(),
    last_error: null,
    condition_substituted_from: p.substituted ? p.wantedCondition : null,
    condition_substituted_to: p.substituted ? p.condition : null,
    ad_id: adId,
    unmapped_aspects: p.aspectResult.unmapped,
    aspect_summary: {
      filled: p.aspectResult.recommendedFilled,
      total: p.aspectResult.recommendedTotal,
      missing: p.aspectResult.missingRecommended,
    },
  });

  return {
    offerId: offerId!,
    listingId,
    url,
    warnings,
    substitution: p.substituted ? { from: p.wantedCondition, to: p.condition! } : null,
  };
}

/** Ends the eBay listing (sold elsewhere or manual pull). */
export async function endEbayListing(supabase: Client, bikeId: string): Promise<boolean> {
  const { data: listing } = await supabase
    .from('ebay_listings')
    .select('*')
    .eq('bike_id', bikeId)
    .maybeSingle();
  const offerId = (listing as any)?.offer_id as string | undefined;
  if (!offerId) return false;

  const conn = await requireConnection(supabase, await businessIdForBike(supabase, bikeId));
  await removeAd(conn, listing);
  try {
    await ebayFetch(conn, `/sell/inventory/v1/offer/${offerId}/withdraw`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  } catch (e) {
    const message = (e as Error).message;
    if (!/not published|cannot be withdrawn|does not exist/i.test(message)) throw e;
  }

  await upsertListing(supabase, bikeId, {
    status: 'ended',
    quantity: 0,
    listing_id: null,
    ad_id: null,
    last_synced_at: new Date().toISOString(),
    last_error: null,
  });
  return true;
}

/** Removes the offer and inventory item entirely. */
export async function deleteEbayListing(supabase: Client, bikeId: string): Promise<boolean> {
  const { data: listing } = await supabase
    .from('ebay_listings')
    .select('*')
    .eq('bike_id', bikeId)
    .maybeSingle();
  if (!listing) return false;
  const offerId = (listing as any).offer_id as string | undefined;
  const sku = (listing as any).sku as string | undefined;

  const conn = await requireConnection(supabase, await businessIdForBike(supabase, bikeId));
  await removeAd(conn, listing);
  if (offerId) {
    try {
      await ebayFetch(conn, `/sell/inventory/v1/offer/${offerId}/withdraw`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
    } catch { /* may not be published */ }
    try {
      await ebayFetch(conn, `/sell/inventory/v1/offer/${offerId}`, { method: 'DELETE' });
    } catch { /* already gone */ }
  }
  if (sku) {
    try {
      await ebayFetch(conn, `/sell/inventory/v1/inventory_item/${encodeURIComponent(sku)}`, {
        method: 'DELETE',
      });
    } catch { /* already gone */ }
  }

  await supabase.from('ebay_listings').delete().eq('bike_id', bikeId);
  return true;
}

/** Records a failure against the bike's listing without throwing. */
export async function recordListingError(supabase: Client, bikeId: string, message: string) {
  await upsertListing(supabase, bikeId, { last_error: message.slice(0, 500) });
}
