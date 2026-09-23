// Receives Squarespace order.create notifications, verifies the signature and marks sold bikes.
import { serviceClient, accessToken, sqsFetch, verifySignature } from '../_shared/squarespace.ts';
import { markBikeSoldOut } from '../_shared/shopify-listing.ts';
import { endEbayListing } from '../_shared/ebay-listing.ts';
import { logBikeActivity } from '../_shared/activity.ts';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('ok');
  const supabase = serviceClient();
  const raw = await req.text();
  let payload: any;
  try { payload = JSON.parse(raw); } catch { return new Response('bad json', { status: 400 }); }

  const websiteId = String(payload.websiteId ?? '');
  const { data: rows } = await supabase.from('integrations').select('business_id, settings')
    .eq('name', 'squarespace').eq('is_active', true).eq('settings->>website_id', websiteId);
  const signature = req.headers.get('Squarespace-Signature') || '';
  let businessId: string | null = null;
  for (const r of rows ?? []) {
    const secret = (r.settings as any)?.webhook_secret;
    if (secret && signature && await verifySignature(secret, raw, signature)) { businessId = r.business_id; break; }
  }
  if (!businessId) return new Response('invalid signature', { status: 401 });

  if (payload.topic !== 'order.create') return new Response('ignored');
  const orderId = payload.data?.orderId;
  if (!orderId) return new Response('no order');

  try {
    const { token } = await accessToken(supabase, businessId);
    const order = await sqsFetch(token, `/1.0/commerce/orders/${orderId}`);
    for (const li of order.lineItems ?? []) {
      const { data: listing } = await supabase.from('squarespace_listings').select('bike_id')
        .eq('business_id', businessId)
        .or(`variant_id.eq.${li.variantId},product_id.eq.${li.productId}`).maybeSingle();
      let bikeId = listing?.bike_id as string | undefined;
      if (!bikeId && li.sku) {
        const { data: b } = await supabase.from('bikes').select('id').eq('business_id', businessId).eq('reference', li.sku).maybeSingle();
        bikeId = b?.id;
      }
      if (!bikeId) continue;
      const total = Number(li.unitPricePaid?.value ?? order.grandTotal?.value ?? 0);
      const currency = li.unitPricePaid?.currency ?? order.grandTotal?.currency ?? 'GBP';
      const { data: bike } = await supabase.from('bikes').select('status').eq('id', bikeId).maybeSingle();
      if (bike && bike.status !== 'sold') {
        await supabase.from('bikes').update({ status: 'sold', sale_price: total || null, sold_at: order.createdOn ?? new Date().toISOString() }).eq('id', bikeId);
      }
      await supabase.from('squarespace_listings').update({ status: 'sold_out', updated_at: new Date().toISOString() }).eq('bike_id', bikeId);
      try { await markBikeSoldOut(supabase, bikeId); } catch (e) { console.warn('Shopify sold-out failed', (e as Error).message); }
      try { await endEbayListing(supabase, bikeId); } catch (e) { console.warn('eBay end failed', (e as Error).message); }
      await logBikeActivity(bikeId, {
        kind: 'sale', action: 'squarespace_sold',
        summary: `Sold on Squarespace for ${currency === 'GBP' ? '£' : `${currency} `}${total.toLocaleString('en-GB')}`,
        detail: { order_id: orderId, order_number: order.orderNumber ?? null, total, currency },
        actorLabel: 'Squarespace',
      }, businessId);
    }
  } catch (e) {
    console.error('squarespace-webhook error', (e as Error).message);
    return new Response('error', { status: 500 });
  }
  return new Response('ok');
});
