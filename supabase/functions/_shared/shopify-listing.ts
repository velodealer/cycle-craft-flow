// Builds Shopify products from VeloDealer bikes and keeps the shopify_listings table in step.
import {
  shopifyGraphql,
  requireConnection,
  type Client,
  type ShopifySettings,
} from './shopify.ts';
import { loadFieldMap, renderFieldValue, loadBikeComponents, isPublishBlockingError } from './listing-template.ts';

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
}

const PRODUCT_SET = `
mutation velodealerProductSet($input: ProductSetInput!) {
  productSet(synchronous: true, input: $input) {
    product {
      id
      handle
      onlineStoreUrl
      variants(first: 1) { nodes { id sku inventoryItem { id } } }
    }
    userErrors { field message }
  }
}`;

const INVENTORY_SET = `
mutation velodealerInventorySet($input: InventorySetQuantitiesInput!) {
  inventorySetQuantities(input: $input) {
    userErrors { field message }
  }
}`;

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function bikeTitle(bike: BikeRow): string {
  return [bike.make, bike.model, bike.year ? String(bike.year) : '', bike.size ? `(${bike.size})` : '']
    .filter(Boolean)
    .join(' ')
    .trim();
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
  return `${paragraphs}${rows ? `<ul>${rows}</ul>` : ''}`;
}

export function bikeTags(bike: BikeRow): string[] {
  return [bike.make, bike.bike_type, bike.size ? `Size ${bike.size}` : '', bike.colour, bike.frame_material]
    .map((t) => String(t ?? '').trim())
    .filter(Boolean)
    .slice(0, 10);
}

async function upsertListing(supabase: Client, bikeId: string, patch: Record<string, unknown>) {
  const { data: bikeRow } = await supabase
    .from('bikes')
    .select('business_id')
    .eq('id', bikeId)
    .maybeSingle();
  const { error } = await supabase
    .from('shopify_listings')
    .upsert(
      { bike_id: bikeId, business_id: (bikeRow as any)?.business_id ?? null, ...patch, updated_at: new Date().toISOString() },
      { onConflict: 'bike_id' },
    );
  if (error) console.error('shopify_listings upsert failed:', error.message);
}

async function setInventory(
  settings: ShopifySettings & { shop_domain: string; access_token: string },
  inventoryItemId: string,
  quantity: number,
) {
  if (!settings.location_id) return;
  const locationGid = settings.location_id.startsWith('gid://')
    ? settings.location_id
    : `gid://shopify/Location/${settings.location_id}`;
  const data = await shopifyGraphql(settings, INVENTORY_SET, {
    input: {
      name: 'available',
      reason: 'correction',
      ignoreCompareQuantity: true,
      quantities: [{ inventoryItemId, locationId: locationGid, quantity }],
    },
  });
  const errors = data?.inventorySetQuantities?.userErrors ?? [];
  if (errors.length) throw new Error(errors.map((e: any) => e.message).join('; '));
}

const METAFIELD_TYPES = new Set(['single_line_text_field', 'multi_line_text_field', 'number_integer', 'number_decimal', 'boolean']);

const DEFINITION_CREATE = `
mutation velodealerMetafieldDefinition($definition: MetafieldDefinitionInput!) {
  metafieldDefinitionCreate(definition: $definition) {
    createdDefinition { id }
    userErrors { field message code }
  }
}`;

function coerce(type: string, value: string): string | null {
  if (type === 'boolean') {
    const v = value.toLowerCase();
    if (['yes', 'true', '1'].includes(v)) return 'true';
    if (['no', 'false', '0'].includes(v)) return 'false';
    return null;
  }
  if (type === 'number_integer') {
    const n = parseInt(value.replace(/[^0-9-]/g, ''), 10);
    return Number.isFinite(n) ? String(n) : null;
  }
  if (type === 'number_decimal') {
    const n = parseFloat(value.replace(/[^0-9.-]/g, ''));
    return Number.isFinite(n) ? String(n) : null;
  }
  if (type === 'single_line_text_field') return value.replace(/\s*\n\s*/g, ' ').slice(0, 255);
  return value;
}

/** Renders the dealer's Shopify metafield mapping for a bike and ensures definitions exist. */
async function buildMetafields(
  supabase: Client,
  settings: ShopifySettings & { shop_domain: string; access_token: string },
  bikeId: string,
): Promise<{ metafields: any[]; warnings: string[] }> {
  const warnings: string[] = [];
  try {
    const { data: full } = await supabase.from('bikes').select('*').eq('id', bikeId).maybeSingle();
    if (!full) return { metafields: [], warnings };
    const map = await loadFieldMap(supabase, 'shopify', (full as any).business_id);
    const rows = Array.isArray(map) ? map : [];
    if (!rows.length) return { metafields: [], warnings };
    const comps = await loadBikeComponents(supabase, bikeId);
    const metafields: any[] = [];
    for (const r of rows) {
      const [namespace, ...rest] = String(r?.key ?? '').split('.');
      const key = rest.join('.');
      const type = METAFIELD_TYPES.has(r?.type) ? r.type : 'single_line_text_field';
      if (!namespace || !key) continue;
      const raw = renderFieldValue(String(r?.value ?? ''), full, comps);
      if (!raw) continue;
      const value = coerce(type, raw);
      if (value == null) { warnings.push(`${r.key}: "${raw}" isn't a valid ${type}`); continue; }
      metafields.push({ namespace, key, type, value });
    }
    for (const m of metafields) {
      try {
        const d = await shopifyGraphql(settings, DEFINITION_CREATE, {
          definition: {
            name: m.key.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
            namespace: m.namespace, key: m.key, type: m.type, ownerType: 'PRODUCT',
          },
        });
        const errs = d?.metafieldDefinitionCreate?.userErrors ?? [];
        const real = errs.filter((e: any) => e.code !== 'TAKEN');
        if (real.length) warnings.push(`${m.namespace}.${m.key}: ${real.map((e: any) => e.message).join('; ')}`);
      } catch (e) {
        console.error('Metafield definition failed:', (e as Error).message);
      }
    }
    return { metafields, warnings };
  } catch (e) {
    if (isPublishBlockingError(e)) throw e; // failed data load must stop the publish
    warnings.push(`Metafield mapping failed: ${(e as Error).message}`);
    return { metafields: [], warnings };
  }
}

/** Creates or updates the Shopify product for a bike. quantity 1 = for sale, 0 = sold out. */
export async function pushBikeToShopify(
  supabase: Client,
  bike: BikeRow,
  quantity: number,
): Promise<{ productId: string; url: string | null }> {
  const settings = await requireConnection(supabase);

  const { data: listing } = await supabase
    .from('shopify_listings')
    .select('*')
    .eq('bike_id', bike.id)
    .maybeSingle();
  const existingProductId = (listing as any)?.product_id as string | undefined;

  const images = (bike.photos ?? []).filter((u) => typeof u === 'string' && /^https?:\/\//.test(u)).slice(0, 10);

  const { metafields, warnings } = await buildMetafields(supabase, settings, bike.id);

  const input: Record<string, unknown> = {
    title: bikeTitle(bike),
    descriptionHtml: bikeDescriptionHtml(bike),
    productType: settings.product_type || 'Bicycle',
    vendor: settings.vendor || bike.make,
    tags: bikeTags(bike),
    status: 'ACTIVE',
    variants: [
      {
        price: bike.asking_price != null ? String(bike.asking_price) : '0',
        sku: bike.reference || bike.id,
        inventoryItem: { tracked: true },
        inventoryPolicy: 'DENY',
      },
    ],
  };
  if (metafields.length) input.metafields = metafields;
  if (existingProductId) {
    input.id = existingProductId;
  } else if (images.length) {
    input.files = images.map((src) => ({ originalSource: src, contentType: 'IMAGE' }));
  }

  let data = await shopifyGraphql(settings, PRODUCT_SET, { input });
  let errors = data?.productSet?.userErrors ?? [];
  if (errors.length && metafields.length && errors.some((e: any) => JSON.stringify(e.field ?? '').includes('metafields'))) {
    warnings.push(`Metafields skipped: ${errors.map((e: any) => e.message).join('; ')}`);
    delete input.metafields;
    data = await shopifyGraphql(settings, PRODUCT_SET, { input });
    errors = data?.productSet?.userErrors ?? [];
  }
  if (errors.length) throw new Error(errors.map((e: any) => e.message).join('; '));

  const product = data.productSet.product;
  const variant = product?.variants?.nodes?.[0];
  const inventoryItemId = variant?.inventoryItem?.id as string | undefined;

  if (inventoryItemId) {
    try {
      await setInventory(settings, inventoryItemId, quantity);
    } catch (e) {
      console.error('Shopify inventory update failed:', (e as Error).message);
    }
  }

  const adminUrl = `https://${settings.shop_domain}/admin/products/${String(product.id).split('/').pop()}`;

  await upsertListing(supabase, bike.id, {
    shop_domain: settings.shop_domain,
    product_id: product.id,
    variant_id: variant?.id ?? null,
    inventory_item_id: inventoryItemId ?? null,
    location_id: settings.location_id ?? null,
    product_url: product.onlineStoreUrl ?? adminUrl,
    status: quantity > 0 ? 'listed' : 'sold_out',
    quantity,
    last_synced_at: new Date().toISOString(),
    last_error: warnings.length ? `Listed, with warnings: ${warnings.join(' | ')}`.slice(0, 500) : null,
  });

  return { productId: product.id, url: product.onlineStoreUrl ?? adminUrl };
}

/** Leaves the product active but sets its stock to zero (sold elsewhere). */
export async function markBikeSoldOut(supabase: Client, bikeId: string): Promise<boolean> {
  const { data: listing } = await supabase
    .from('shopify_listings')
    .select('*')
    .eq('bike_id', bikeId)
    .maybeSingle();
  if (!listing || !(listing as any).inventory_item_id) return false;

  const settings = await requireConnection(supabase);
  await setInventory(settings, (listing as any).inventory_item_id, 0);
  await upsertListing(supabase, bikeId, {
    status: 'sold_out',
    quantity: 0,
    last_synced_at: new Date().toISOString(),
    last_error: null,
  });
  return true;
}

/** Removes the product from Shopify entirely (manual "Remove listing"). */
export async function deleteShopifyProduct(supabase: Client, bikeId: string): Promise<boolean> {
  const { data: listing } = await supabase
    .from('shopify_listings')
    .select('*')
    .eq('bike_id', bikeId)
    .maybeSingle();
  const productId = (listing as any)?.product_id as string | undefined;
  if (!productId) return false;

  const settings = await requireConnection(supabase);
  const data = await shopifyGraphql(
    settings,
    `mutation velodealerProductDelete($input: ProductDeleteInput!) {
      productDelete(input: $input) { deletedProductId userErrors { field message } }
    }`,
    { input: { id: productId } },
  );
  const errors = data?.productDelete?.userErrors ?? [];
  if (errors.length) throw new Error(errors.map((e: any) => e.message).join('; '));

  await supabase.from('shopify_listings').delete().eq('bike_id', bikeId);
  return true;
}

/** Records a failure against the bike's listing without throwing. */
export async function recordListingError(supabase: Client, bikeId: string, message: string) {
  await upsertListing(supabase, bikeId, { last_error: message.slice(0, 500) });
}
