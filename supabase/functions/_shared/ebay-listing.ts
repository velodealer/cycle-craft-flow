// Builds eBay listings from VeloDealer bikes and keeps the ebay_listings table in step.
import { ebayFetch, requireConnection, businessIdForBike, itemBase, type Client, type Connection } from './ebay.ts';

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

/** Required item specifics for a category, as eBay names them. Empty when the lookup fails. */
async function requiredAspects(conn: Connection, categoryId: string): Promise<string[]> {
  const treeId = CATEGORY_TREE_ID[conn.settings.marketplace_id || 'EBAY_GB'] || '3';
  try {
    const data = await ebayFetch<any>(
      conn,
      `/commerce/taxonomy/v1/category_tree/${treeId}/get_item_aspects_for_category?category_id=${encodeURIComponent(categoryId)}`,
    );
    return (data?.aspects ?? [])
      .filter((a: any) => a?.aspectConstraint?.aspectRequired)
      .map((a: any) => String(a?.localizedAspectName || '').trim())
      .filter(Boolean);
  } catch (e) {
    console.warn('Could not read required eBay item specifics:', (e as Error).message);
    return [];
  }
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

/** Makes sure a merchant location exists — eBay requires one for every offer. */
async function ensureLocation(conn: Connection): Promise<string> {
  const key = conn.settings.merchant_location_key || DEFAULT_LOCATION_KEY;
  try {
    await ebayFetch(conn, `/sell/inventory/v1/location/${encodeURIComponent(key)}`);
    return key;
  } catch { /* create below */ }

  await ebayFetch(conn, `/sell/inventory/v1/location/${encodeURIComponent(key)}`, {
    method: 'POST',
    body: JSON.stringify({
      location: {
        address: {
          country: 'GB',
          postalCode: conn.settings.postcode || 'BN1 1AA',
        },
      },
      locationInstructions: 'Collection and despatch point',
      name: 'VeloDealer',
      merchantLocationStatus: 'ENABLED',
      locationTypes: ['WAREHOUSE'],
    }),
  });
  return key;
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
  const conn = await requireConnection(supabase, await businessIdForBike(supabase, bike.id));
  const s = conn.settings;
  if (!s.fulfillment_policy_id || !s.payment_policy_id || !s.return_policy_id) {
    throw new Error('Choose your eBay postage, payment and returns policies in Settings → Integrations first.');
  }
  if (bike.asking_price == null || Number(bike.asking_price) <= 0) {
    throw new Error('Set an asking price on the bike before listing it on eBay.');
  }

  const sku = skuFor(bike);
  const locationKey = await ensureLocation(conn);
  const images = (bike.photos ?? [])
    .filter((u) => typeof u === 'string' && /^https?:\/\//.test(u))
    .slice(0, 12);

  // Per-bike overrides take priority over the account defaults.
  const { data: existing } = await supabase
    .from('ebay_listings')
    .select('*')
    .eq('bike_id', bike.id)
    .maybeSingle();

  const bikeCondition = ((existing as any)?.condition as string | null) || s.condition || 'USED_EXCELLENT';
  const bikeCategoryId = ((existing as any)?.category_id as string | null) || s.category_id || DEFAULT_CATEGORY;

  await ebayFetch(conn, `/sell/inventory/v1/inventory_item/${encodeURIComponent(sku)}`, {
    method: 'PUT',
    body: JSON.stringify({
      availability: { shipToLocationAvailability: { quantity: 1 } },
      condition: bikeCondition,
      product: {
        title: bikeTitle(bike),
        description: bikeDescriptionHtml(bike),
        imageUrls: images,
        aspects: aspects(bike),
        brand: bike.make,
        mpn: bike.model,
      },
    }),
  });

  let offerId = ((existing as any)?.offer_id as string | undefined) || (await findOfferId(conn, sku));

  const offerBody = {
    sku,
    marketplaceId: s.marketplace_id || 'EBAY_GB',
    format: 'FIXED_PRICE',
    availableQuantity: 1,
    categoryId: bikeCategoryId,
    listingDescription: bikeDescriptionHtml(bike),
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
