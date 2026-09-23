// Builds eBay listings from VeloDealer bikes and keeps the ebay_listings table in step.
import { ebayFetch, requireConnection, businessIdForBike, itemBase, type Client, type Connection } from './ebay.ts';
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

function aspects(bike: BikeRow): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  const add = (key: string, value: unknown) => {
    const v = String(value ?? '').trim();
    if (v && !out[key]) out[key] = [v.slice(0, 60)];
  };
  add('Brand', bike.make);
  add('Model', bike.model);
  add('Bike Type', ebayBikeType(bike));
  add('Type', ebayBikeType(bike));
  add('Frame Size', bike.size);
  add('Colour', bike.colour);
  add('Color', bike.colour);
  add('Frame Material', bike.frame_material);
  add('Wheel Size', specValue(bike, 'wheel_size'));
  add('Number of Gears', specValue(bike, 'gears') || specValue(bike, 'speeds'));
  add('Brake Type', specValue(bike, 'brake_type'));
  add('Suspension Type', specValue(bike, 'suspension'));
  add('Gender', bike.gender);
  if (bike.year) add('Year', String(bike.year));
  return out;
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

function requiredAspectNames(meta: any[]): string[] {
  return meta
    .filter((a: any) => a?.aspectConstraint?.aspectRequired)
    .map((a: any) => String(a?.localizedAspectName || '').trim())
    .filter(Boolean);
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

/** Creates or updates the eBay listing for a bike and publishes it. */
export async function pushBikeToEbay(
  supabase: Client,
  bike: BikeRow,
): Promise<{ offerId: string; listingId: string | null; url: string | null }> {
  const businessId = await businessIdForBike(supabase, bike.id);
  const conn = await requireConnection(supabase, businessId);
  const s = conn.settings;
  if (!s.fulfillment_policy_id || !s.payment_policy_id || !s.return_policy_id) {
    throw new Error('Choose your eBay postage, payment and returns policies in Settings → Integrations first.');
  }
  if (bike.asking_price == null || Number(bike.asking_price) <= 0) {
    throw new Error('Set an asking price on the bike before listing it on eBay.');
  }
  if (!ebayBikeType(bike)) {
    throw new Error('Add a bike type before listing on eBay.');
  }


  const sku = skuFor(bike);
  // Use the dealer's saved eBay listing format when there is one.
  let descriptionHtml = bikeDescriptionHtml(bike);
  try {
    const tpl = await loadListingTemplate(supabase, 'ebay', businessId);
    if (tpl) {
      const components = /\{components\}/.test(tpl.body || '')
        ? await loadBikeComponents(supabase, bike.id)
        : [];
      descriptionHtml = renderListingHtml(tpl, bike, components) || descriptionHtml;
    }
  } catch (e) {
    console.error('listing template render failed, using default description:', (e as Error).message);
  }
  const locationKey = await ensureLocation(supabase, conn, businessId);
  const images = (bike.photos ?? [])
    .filter((u) => typeof u === 'string' && /^https?:\/\//.test(u))
    .slice(0, 12);

  // Per-bike overrides take priority over the account defaults.
  const { data: existing } = await supabase
    .from('ebay_listings')
    .select('*')
    .eq('bike_id', bike.id)
    .maybeSingle();

  const warnings: string[] = [];
  const wantedCondition = ((existing as any)?.condition as string | null) || s.condition || 'USED_EXCELLENT';
  const bikeCategoryId = ((existing as any)?.category_id as string | null) || s.category_id || DEFAULT_CATEGORY;
  const resolved = await resolveCondition(supabase, conn, bikeCategoryId, wantedCondition);
  const bikeCondition = resolved.condition;
  if (resolved.substituted) {
    warnings.push(`eBay doesn't accept "${conditionLabel(wantedCondition)}" in this category, so it was listed as "${conditionLabel(bikeCondition)}".`);
  }

  const meta = await categoryAspects(supabase, conn, bikeCategoryId);
  const brand = normaliseBrand(meta, bike.make);
  const itemAspects = aspects({ ...bike, make: brand });
  const required = requiredAspectNames(meta);
  const missing = required.filter((name) => !itemAspects[name]);
  if (missing.length) {
    throw new Error(`eBay needs these details on the bike before it can be listed: ${missing.join(', ')}.`);
  }

  // Condition notes, led by the InspectABike grade when there is one.
  const { data: inspection } = await supabase
    .from('inspections')
    .select('overall_grade')
    .eq('bike_id', bike.id)
    .not('overall_grade', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const grade = (inspection as any)?.overall_grade != null ? Number((inspection as any).overall_grade) : null;
  const condDesc = conditionDescription(bike.condition_notes, grade);
  if (!String(bike.condition_notes ?? '').trim()) {
    warnings.push('Used bikes sell better and get fewer disputes with condition notes.');
  }

  const mpn = String(bike.mpn ?? '').trim();
  const product: Record<string, unknown> = {
    title: bikeTitle(bike),
    description: inventorySummary(bike),
    imageUrls: images,
    aspects: itemAspects,
    brand,
  };
  if (mpn) product.mpn = mpn.slice(0, 65);

  const inventoryBody: Record<string, unknown> = {
    availability: { shipToLocationAvailability: { quantity: 1 } },
    condition: bikeCondition,
    product,
  };
  if (condDesc && !bikeCondition.startsWith('NEW') && bikeCondition !== 'LIKE_NEW') {
    inventoryBody.conditionDescription = condDesc;
  }

  await ebayFetch(conn, `/sell/inventory/v1/inventory_item/${encodeURIComponent(sku)}`, {
    method: 'PUT',
    body: JSON.stringify(inventoryBody),
  });

  let offerId = ((existing as any)?.offer_id as string | undefined) || (await findOfferId(conn, sku));

  const offerBody = {
    sku,
    marketplaceId: s.marketplace_id || 'EBAY_GB',
    format: 'FIXED_PRICE',
    availableQuantity: 1,
    categoryId: bikeCategoryId,
    listingDescription: descriptionHtml,
    merchantLocationKey: locationKey,
    listingPolicies: {
      fulfillmentPolicyId: s.fulfillment_policy_id,
      paymentPolicyId: s.payment_policy_id,
      returnPolicyId: s.return_policy_id,
    },
    pricingSummary: {
      price: { value: String(bike.asking_price), currency: s.currency || 'GBP' },
    },
  };

  if (offerId) {
    await ebayFetch(conn, `/sell/inventory/v1/offer/${offerId}`, {
      method: 'PUT',
      body: JSON.stringify(offerBody),
    });
  } else {
    const created = await ebayFetch<any>(conn, '/sell/inventory/v1/offer', {
      method: 'POST',
      body: JSON.stringify(offerBody),
    });
    offerId = created?.offerId as string;
  }

  let listingId = ((existing as any)?.listing_id as string | null) ?? null;
  try {
    const published = await ebayFetch<any>(conn, `/sell/inventory/v1/offer/${offerId}/publish`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    listingId = published?.listingId ?? listingId;
  } catch (e) {
    const message = (e as Error).message;
    if (!/already published/i.test(message)) throw e;
  }

  const url = listingId ? `${itemBase(conn.environment)}${listingId}` : null;

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
  });

  return { offerId: offerId!, listingId, url };
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
