// Builds Squarespace products from VeloDealer bikes and keeps squarespace_listings in step.
import { accessToken, sqsFetch, businessIdForBike, type Client } from './squarespace.ts';
import { loadListingTemplate, renderListingHtml, loadBikeComponents, loadFieldMap, renderFieldValue } from './listing-template.ts';

const BIKE_FIELDS = '*';

function title(b: any) {
  return [b.year, b.make, b.model, b.size ? `(${b.size})` : null].filter(Boolean).join(' ').slice(0, 200);
}

function slug(b: any) {
  return `${b.make}-${b.model}-${b.reference || b.id}`.toLowerCase().normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 120);
}

async function description(supabase: Client, bike: any, businessId: string) {
  try {
    const comps = await loadBikeComponents(supabase, bike.id);
    const tpl = (await loadListingTemplate(supabase, 'squarespace', businessId))
      || (await loadListingTemplate(supabase, 'shopify', businessId));
    const html = renderListingHtml(tpl, bike, comps);
    if (html) return html;
  } catch (e) {
    console.error('Squarespace template render failed:', (e as Error).message);
  }
  const text = bike.listing_description || bike.description || title(bike);
  return `<p>${String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\n/g, '<br>')}</p>`;
}

async function loadBike(supabase: Client, bikeId: string) {
  const { data, error } = await supabase.from('bikes').select(BIKE_FIELDS).eq('id', bikeId).maybeSingle();
  if (error || !data) throw new Error('Bike not found');
  return data as any;
}

async function listingRow(supabase: Client, bikeId: string) {
  const { data } = await supabase.from('squarespace_listings').select('*').eq('bike_id', bikeId).maybeSingle();
  return data as any;
}

async function upsertListing(supabase: Client, bikeId: string, businessId: string, patch: Record<string, unknown>) {
  const { error } = await supabase.from('squarespace_listings').upsert(
    { bike_id: bikeId, business_id: businessId, ...patch, updated_at: new Date().toISOString() },
    { onConflict: 'bike_id' },
  );
  if (error) throw new Error(error.message);
}

async function setStock(token: string, variantId: string, quantity: number) {
  await sqsFetch(token, '/1.0/commerce/inventory/adjustments', {
    method: 'POST',
    headers: { 'Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify({ setFiniteOperations: [{ variantId, quantity }] }),
  });
}

async function uploadImages(token: string, productId: string, photos: string[]) {
  for (const src of photos.slice(0, 10)) {
    try {
      const r = await fetch(src);
      if (!r.ok) continue;
      const blob = await r.blob();
      const ext = (blob.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
      const form = new FormData();
      form.append('file', blob, `photo.${ext}`);
      await sqsFetch(token, `/1.0/commerce/products/${productId}/images`, { method: 'POST', body: form });
    } catch (e) {
      console.error('Squarespace image upload failed:', (e as Error).message);
    }
  }
}

/** Creates or updates the Squarespace product for a bike (quantity 1 = for sale, 0 = sold out). */
export async function pushBikeToSquarespace(supabase: Client, bikeId: string, quantity = 1) {
  const businessId = await businessIdForBike(supabase, bikeId);
  const { token, settings } = await accessToken(supabase, businessId);
  if (!settings.store_page_id) throw new Error('Choose which Squarespace store page bikes go into, under Settings → Integrations → Squarespace.');
  const bike = await loadBike(supabase, bikeId);
  if (!bike.asking_price) throw new Error('Add an asking price before listing on Squarespace.');
  const existing = await listingRow(supabase, bikeId);
  const currency = settings.currency || 'GBP';
  const price = { currency, value: Number(bike.asking_price).toFixed(2) };
  const desc = await description(supabase, bike, businessId);
  const photos = (bike.photos ?? []).filter((u: unknown) => typeof u === 'string' && /^https?:\/\//.test(u as string));

  // Dealer field mapping: tags, categories, SEO and URL slug.
  const extra: Record<string, unknown> = {};
  let tags = [bike.make, bike.bike_type, bike.size].filter(Boolean).map(String);
  let urlSlug = slug(bike);
  try {
    const map = await loadFieldMap(supabase, 'squarespace', businessId);
    if (map && !Array.isArray(map)) {
      const comps = await loadBikeComponents(supabase, bikeId);
      const r = (t: unknown) => renderFieldValue(String(t ?? ''), bike, comps);
      const list = (xs: unknown) => (Array.isArray(xs) ? xs.map(r).filter(Boolean).map((s) => s.slice(0, 80)) : []);
      const mt = list(map.tags);
      if (mt.length) tags = [...new Set(mt)];
      const cats = list(map.categories);
      if (cats.length) extra.categories = [...new Set(cats)];
      const seoTitle = r(map.seo_title), seoDesc = r(map.seo_description);
      if (seoTitle || seoDesc) extra.seoOptions = { ...(seoTitle ? { title: seoTitle.slice(0, 200) } : {}), ...(seoDesc ? { description: seoDesc.slice(0, 400) } : {}) };
      const s = r(map.url_slug).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 120);
      if (s) urlSlug = s;
    }
  } catch (e) {
    console.error('Squarespace field mapping failed:', (e as Error).message);
  }

  let productId: string = existing?.product_id;
  let variantId: string = existing?.variant_id;
  let url: string | null = existing?.url ?? null;

  try {
    if (productId) {
      const p = await sqsFetch(token, `/1.0/commerce/products/${productId}`, {
        method: 'POST',
        body: JSON.stringify({ name: title(bike), description: desc, isVisible: true, tags, urlSlug, ...extra }),
      });
      url = p?.url ?? url;
      if (variantId) {
        await sqsFetch(token, `/1.0/commerce/products/${productId}/variants/${variantId}`, {
          method: 'POST',
          body: JSON.stringify({ sku: bike.reference || bike.id, pricing: { basePrice: price } }),
        });
      }
    } else {
      const p = await sqsFetch(token, '/1.0/commerce/products', {
        method: 'POST',
        body: JSON.stringify({
          type: 'PHYSICAL',
          storePageId: settings.store_page_id,
          name: title(bike),
          description: desc,
          urlSlug,
          isVisible: true,
          tags,
          ...extra,
          variants: [{
            sku: bike.reference || bike.id,
            pricing: { basePrice: price },
            stock: { quantity, unlimited: false },
          }],
        }),
      });
      productId = p.id;
      variantId = p.variants?.[0]?.id;
      url = p.url ?? null;
      await uploadImages(token, productId, photos);
    }
    if (variantId) await setStock(token, variantId, quantity);
  } catch (e) {
    await upsertListing(supabase, bikeId, businessId, { last_error: (e as Error).message.slice(0, 500) });
    throw e;
  }

  await upsertListing(supabase, bikeId, businessId, {
    website_id: settings.website_id ?? null,
    product_id: productId,
    variant_id: variantId ?? null,
    url,
    status: quantity > 0 ? 'listed' : 'sold_out',
    last_synced_at: new Date().toISOString(),
    last_error: null,
  });
  return { productId, url };
}

export async function markSquarespaceSoldOut(supabase: Client, bikeId: string): Promise<boolean> {
  const row = await listingRow(supabase, bikeId);
  if (!row?.variant_id || row.status !== 'listed') return false;
  const { token } = await accessToken(supabase, row.business_id);
  await setStock(token, row.variant_id, 0);
  await supabase.from('squarespace_listings').update({ status: 'sold_out', last_synced_at: new Date().toISOString() }).eq('bike_id', bikeId);
  return true;
}

export async function removeSquarespaceProduct(supabase: Client, bikeId: string): Promise<boolean> {
  const row = await listingRow(supabase, bikeId);
  if (!row?.product_id) return false;
  const { token } = await accessToken(supabase, row.business_id);
  try {
    await sqsFetch(token, `/1.0/commerce/products/${row.product_id}`, { method: 'DELETE' });
  } catch (e) {
    if (!String((e as Error).message).includes('[404]')) throw e;
  }
  await supabase.from('squarespace_listings').delete().eq('bike_id', bikeId);
  return true;
}
