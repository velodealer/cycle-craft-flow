// Lists stock parts (ticked "for sale") on eBay and Shopify and keeps the part row in step.
// Parts only ever send their own parts.listing_photos — never bike photos.
import { ebayFetch, requireConnection as requireEbay, itemBase, type Client, type Connection } from './ebay.ts';
import { ensureLocation, categoryAspects, allowedConditionIds, mapCondition, findOfferId } from './ebay-listing.ts';
import { requireConnection as requireShopify, shopifyGraphql } from './shopify.ts';
import { setInventory } from './shopify-listing.ts';
import { channelPrice, loadChannelSettings } from './channel-price-loader.ts';
import { applyTitleAffixes } from './channel-pricing.ts';
import { partTitle, partSku, partReadiness } from './part-listing-rules.ts';

export { partTitle, partSku, partReadiness };

const esc = (v: unknown) => String(v ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));

function descriptionHtml(part: any): string {
  const text = String(part.listing_description || part.description || '').trim();
  const paras = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
    .map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('');
  const facts = [
    part.brand ? `<li>Brand: ${esc(part.brand)}</li>` : '',
    part.part_number ? `<li>Part number: ${esc(part.part_number)}</li>` : '',
  ].join('');
  return paras + (facts ? `<ul>${facts}</ul>` : '');
}

async function savePart(supabase: Client, id: string, patch: Record<string, unknown>) {
  const { error } = await supabase.from('parts').update(patch as any).eq('id', id);
  if (error) throw new Error(`The marketplace accepted the change, but VeloDealer could not save it: ${error.message}`);
}

async function suggestCategory(conn: Connection, q: string): Promise<string | null> {
  try {
    const d = await ebayFetch<any>(conn, `/commerce/taxonomy/v1/category_tree/3/get_category_suggestions?q=${encodeURIComponent(q.slice(0, 100))}`);
    return d?.categorySuggestions?.[0]?.category?.categoryId ?? null;
  } catch { return null; }
}

// ---------------- eBay ----------------

export async function pushPartToEbay(supabase: Client, part: any) {
  const blockers = partReadiness(part);
  if (blockers.length) throw new Error(blockers.join(' '));
  const businessId = part.business_id as string;
  const conn = await requireEbay(supabase, businessId);
  const s = conn.settings;
  if (!s.fulfillment_policy_id || !s.payment_policy_id || !s.return_policy_id) {
    throw new Error('Choose your eBay postage, payment and returns policies in Settings → Integrations → eBay first.');
  }
  const affix = (await loadChannelSettings(supabase, businessId)).affixes.ebay;
  const title = applyTitleAffixes(partTitle(part), affix, 80);
  const price = await channelPrice(supabase, businessId, 'ebay', Number(part.sale_price));
  const sku = part.ebay_sku || partSku(part);

  const categoryId = part.ebay_category_id || (await suggestCategory(conn, partTitle(part)));
  if (!categoryId) throw new Error('Could not pick an eBay category for this part — enter one on the part.');

  const meta = await categoryAspects(supabase, conn, categoryId);
  const brand = String(part.brand || '').trim() || 'Unbranded';
  const aspects: Record<string, string[]> = { Brand: [brand] };
  const required = meta.filter((a: any) => a?.aspectConstraint?.aspectRequired).map((a: any) => String(a.localizedAspectName));
  if (required.includes('MPN')) aspects.MPN = [String(part.part_number || '').trim() || 'Does Not Apply'];
  const missing = required.filter((n: string) => !(n in aspects));

  const allowed = await allowedConditionIds(supabase, conn, categoryId);
  const cond = mapCondition(part.listing_condition || 'USED_EXCELLENT', allowed);
  if (!cond) throw new Error('This eBay category does not accept the chosen condition — pick a different condition.');

  const images = (part.listing_photos ?? []).filter((u: string) => /^https?:\/\//.test(u)).slice(0, 24);
  const locationKey = await ensureLocation(supabase, conn, businessId);

  await ebayFetch(conn, `/sell/inventory/v1/inventory_item/${encodeURIComponent(sku)}`, {
    method: 'PUT',
    body: JSON.stringify({
      availability: { shipToLocationAvailability: { quantity: 1 } },
      condition: cond.condition,
      product: { title, description: String(part.listing_description || part.description || '').slice(0, 4000), imageUrls: images, aspects },
    }),
  });

  const currency = s.currency || 'GBP';
  const offerBody = {
    sku,
    marketplaceId: s.marketplace_id || 'EBAY_GB',
    format: 'FIXED_PRICE',
    availableQuantity: 1,
    categoryId,
    listingDescription: descriptionHtml(part),
    merchantLocationKey: locationKey,
    listingPolicies: {
      fulfillmentPolicyId: s.fulfillment_policy_id,
      paymentPolicyId: s.payment_policy_id,
      returnPolicyId: s.return_policy_id,
    },
    pricingSummary: { price: { value: Number(price).toFixed(2), currency } },
  };
  let offerId = part.ebay_offer_id || (await findOfferId(conn, sku));
  if (offerId) {
    await ebayFetch(conn, `/sell/inventory/v1/offer/${offerId}`, { method: 'PUT', body: JSON.stringify(offerBody) });
  } else {
    offerId = (await ebayFetch<any>(conn, '/sell/inventory/v1/offer', { method: 'POST', body: JSON.stringify(offerBody) }))?.offerId;
  }
  let listingId: string | null = part.ebay_item_id ?? null;
  try {
    const pub = await ebayFetch<any>(conn, `/sell/inventory/v1/offer/${offerId}/publish`, { method: 'POST', body: '{}' });
    listingId = pub?.listingId ?? listingId;
  } catch (e) {
    const msg = (e as Error).message;
    if (!/already published/i.test(msg)) {
      throw new Error(missing.length ? `${msg} (eBay also wants: ${missing.join(', ')})` : msg);
    }
  }
  const url = listingId ? `${itemBase(conn.environment)}${listingId}` : null;
  // ebay_item_id lets the existing order sync recognise the sale and invoice it.
  await savePart(supabase, part.id, {
    ebay_sku: sku, ebay_offer_id: offerId, ebay_item_id: listingId, ebay_listing_url: url,
    ebay_environment: conn.environment, ebay_category_id: categoryId,
    ebay_listing_status: 'listed', ebay_last_error: null,
  });
  return { url, listingId };
}

export async function endPartOnEbay(supabase: Client, part: any): Promise<boolean> {
  if (!part.ebay_offer_id) return false;
  const conn = await requireEbay(supabase, part.business_id, part.ebay_environment || undefined);
  try {
    await ebayFetch(conn, `/sell/inventory/v1/offer/${part.ebay_offer_id}/withdraw`, { method: 'POST', body: '{}' });
  } catch (e) {
    if (!/not published|cannot be withdrawn|does not exist/i.test((e as Error).message)) throw e;
  }
  await savePart(supabase, part.id, { ebay_listing_status: 'ended', ebay_last_error: null });
  return true;
}

// ---------------- Shopify ----------------

const PRODUCT_SET = `
mutation velodealerPartSet($input: ProductSetInput!) {
  productSet(synchronous: true, input: $input) {
    product { id onlineStoreUrl variants(first: 1) { nodes { id inventoryItem { id } } } }
    userErrors { field message }
  }
}`;

export async function pushPartToShopify(supabase: Client, part: any) {
  const blockers = partReadiness(part);
  if (blockers.length) throw new Error(blockers.join(' '));
  const settings = await requireShopify(supabase);
  const affix = (await loadChannelSettings(supabase, part.business_id)).affixes.shopify;
  const price = await channelPrice(supabase, part.business_id, 'shopify', Number(part.sale_price));
  const images = (part.listing_photos ?? []).filter((u: string) => /^https?:\/\//.test(u)).slice(0, 10);
  const input: Record<string, unknown> = {
    title: applyTitleAffixes(partTitle(part), affix, 255),
    descriptionHtml: descriptionHtml(part),
    productType: 'Bike Parts',
    vendor: part.brand || settings.vendor || 'Parts',
    tags: ['Parts', part.brand].filter(Boolean),
    status: 'ACTIVE',
    variants: [{ price: Number(price).toFixed(2), sku: partSku(part), inventoryItem: { tracked: true }, inventoryPolicy: 'DENY' }],
    files: images.map((src: string) => ({ originalSource: src, contentType: 'IMAGE' })),
  };
  if (part.shopify_product_id) input.id = part.shopify_product_id;
  const data = await shopifyGraphql(settings, PRODUCT_SET, { input });
  const errs = data?.productSet?.userErrors ?? [];
  if (errs.length) throw new Error(errs.map((e: any) => e.message).join('; '));
  const product = data.productSet.product;
  const variant = product?.variants?.nodes?.[0];
  const inv = variant?.inventoryItem?.id ?? null;
  if (inv) await setInventory(settings, inv, 1).catch((e) => console.error('Shopify part stock failed:', e.message));
  const url = product.onlineStoreUrl ?? `https://${settings.shop_domain}/admin/products/${String(product.id).split('/').pop()}`;
  await savePart(supabase, part.id, {
    shopify_product_id: product.id, shopify_variant_id: variant?.id ?? null, shopify_inventory_item_id: inv,
    shopify_product_url: url, shopify_listing_status: 'listed', shopify_last_error: null,
  });
  return { url };
}

export async function markPartSoldOutOnShopify(supabase: Client, part: any): Promise<boolean> {
  if (!part.shopify_inventory_item_id) return false;
  const settings = await requireShopify(supabase);
  await setInventory(settings, part.shopify_inventory_item_id, 0);
  await savePart(supabase, part.id, { shopify_listing_status: 'sold_out', shopify_last_error: null });
  return true;
}

export async function removePartFromShopify(supabase: Client, part: any): Promise<boolean> {
  if (!part.shopify_product_id) return false;
  const settings = await requireShopify(supabase);
  const d = await shopifyGraphql(settings,
    `mutation velodealerPartDelete($input: ProductDeleteInput!) { productDelete(input: $input) { deletedProductId userErrors { message } } }`,
    { input: { id: part.shopify_product_id } });
  const errs = d?.productDelete?.userErrors ?? [];
  if (errs.length) throw new Error(errs.map((e: any) => e.message).join('; '));
  await savePart(supabase, part.id, {
    shopify_product_id: null, shopify_variant_id: null, shopify_inventory_item_id: null,
    shopify_product_url: null, shopify_listing_status: null, shopify_last_error: null,
  });
  return true;
}

/** Takes a sold part off every channel except the one it sold on. Never throws. */
export async function delistPartEverywhere(supabase: Client, partId: string, soldOn: 'ebay' | 'shopify' | 'manual'): Promise<string[]> {
  const notes: string[] = [];
  const { data: part } = await supabase.from('parts').select('*').eq('id', partId).maybeSingle();
  if (!part) return notes;
  if (soldOn !== 'ebay') {
    try { if (await endPartOnEbay(supabase, part)) notes.push('eBay listing ended.'); }
    catch (e) { notes.push(`eBay listing NOT ended: ${(e as Error).message}`); await savePart(supabase, partId, { ebay_last_error: (e as Error).message.slice(0, 500) }).catch(() => {}); }
  } else if (part.ebay_offer_id) {
    await savePart(supabase, partId, { ebay_listing_status: 'sold' }).catch(() => {});
  }
  if (soldOn !== 'shopify') {
    try { if (await markPartSoldOutOnShopify(supabase, part)) notes.push('Shopify stock set to zero.'); }
    catch (e) { notes.push(`Shopify NOT updated: ${(e as Error).message}`); await savePart(supabase, partId, { shopify_last_error: (e as Error).message.slice(0, 500) }).catch(() => {}); }
  } else if (part.shopify_product_id) {
    await savePart(supabase, partId, { shopify_listing_status: 'sold' }).catch(() => {});
  }
  return notes;
}
