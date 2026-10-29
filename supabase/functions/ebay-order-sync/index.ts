// Pulls new eBay orders for every connected dealership (runs every 5 minutes),
// marks the bike sold, ends the Shopify listing and tells the dealer.
// A signed-in admin/owner can also call it to sync just their own dealership.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { isScheduledCall } from '../_shared/scheduled.ts';
import {
  serviceClient,
  requireConnection,
  ebayFetch,
  hasScope,
  saveSettings,
  requireUser,
  requireRole,
  businessIdForUser,
  EBAY_INTEGRATION_NAME,
  type Client,
} from '../_shared/ebay.ts';
import { markBikeSoldOut } from '../_shared/shopify-listing.ts';
import { logBikeActivity } from '../_shared/activity.ts';
import { sendNotification } from '../_shared/email.ts';
import { logSystemError } from '../_shared/system-error.ts';
import { recordPartSale } from '../_shared/part-sale.ts';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const esc = (v: unknown) => String(v ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));

async function syncBusiness(supabase: Client, businessId: string) {
  const conn = await requireConnection(supabase, businessId);
  if (!hasScope(conn.settings, 'sell.fulfillment')) return { businessId, skipped: 'no fulfilment permission' };
  const since = conn.settings.last_order_sync_at
    ? new Date(Date.parse(conn.settings.last_order_sync_at) - 10 * 60_000)
    : new Date(Date.now() - 3 * 24 * 3600_000);
  const startedAt = new Date().toISOString();
  const filter = encodeURIComponent(`creationdate:[${since.toISOString()}..]`);
  const data = await ebayFetch<any>(conn, `/sell/fulfillment/v1/order?filter=${filter}&limit=100`);
  let processed = 0;

  for (const order of (data?.orders ?? []) as any[]) {
    const orderId = String(order.orderId ?? '');
    if (!orderId || order.cancelStatus?.cancelState === 'CANCELED') continue;
    for (const li of (order.lineItems ?? []) as any[]) {
      const sku = String(li.sku ?? '');
      let bikeId: string | null = null;
      if (sku) {
        const { data: listing, error: lErr } = await supabase
          .from('ebay_listings').select('bike_id').eq('business_id', businessId).eq('sku', sku).maybeSingle();
        // Must throw: the order row below is insert-once, so a bikeless insert would never be retried.
        if (lErr) throw new Error(`Could not match eBay order ${orderId} to a bike: ${lErr.message}`);
        bikeId = (listing as any)?.bike_id ?? null;
      }
      // Parts listed by hand on eBay: match the eBay item number saved on the part.
      let part: any = null;
      const itemId = String(li.legacyItemId ?? '');
      if (!bikeId && itemId) {
        const { data: p, error: pErr } = await supabase
          .from('parts').select('id, brand, description, type, cost_price, stock_status')
          .eq('business_id', businessId).eq('ebay_item_id', itemId).neq('stock_status', 'sold')
          .order('created_at').limit(1).maybeSingle();
        if (pErr) throw new Error(`Could not match eBay order ${orderId} to a part: ${pErr.message}`);
        part = p;
      }
      const total = Number(li.total?.value ?? li.lineItemCost?.value ?? order.pricingSummary?.total?.value ?? 0);
      const currency = li.total?.currency ?? order.pricingSummary?.total?.currency ?? 'GBP';
      const recordId = (order.lineItems?.length ?? 1) > 1 ? `${orderId}:${li.lineItemId}` : orderId;

      // Idempotent: the unique (business_id, order_id) key means an order is only processed once.
      const { data: inserted, error } = await supabase.from('ebay_orders').insert({
        business_id: businessId,
        order_id: recordId,
        line_item_id: li.lineItemId ?? null,
        bike_id: bikeId,
        part_id: part?.id ?? null,
        buyer_username: order.buyer?.username ?? null,
        total,
        currency,
        status: 'new',
        raw: order,
      }).select('id').maybeSingle();
      if (error) {
        if (!/duplicate key/i.test(error.message)) console.error('ebay_orders insert failed:', error.message);
        continue;
      }
      if (!inserted) continue;
      processed++;
      if (part) {
        await recordPartSale(supabase, businessId, part, {
          channel: 'ebay', orderId, total, currency,
          buyer: order.buyer?.username ? `eBay: ${order.buyer.username}` : 'eBay buyer',
          date: order.creationDate, ebayOrderRowId: (inserted as any).id,
        });
        continue;
      }
      if (!bikeId) continue;

      const { data: bike, error: bErr } = await supabase
        .from('bikes').select('id, status, make, model, reference, shopify_manual_listed_at').eq('id', bikeId).maybeSingle();
      if (bErr) console.error(`SALE NOT APPLIED: eBay order ${orderId} recorded but bike ${bikeId} could not be loaded: ${bErr.message}`);
      if (!bike) continue;
      if ((bike as any).status !== 'sold') {
        const { error: soldErr } = await supabase.from('bikes').update({
          status: 'sold',
          sale_price: total,
          sold_at: order.creationDate ?? new Date().toISOString(),
        }).eq('id', bikeId);
        if (soldErr) console.error(`SALE NOT APPLIED: eBay order ${orderId} recorded but bike ${bikeId} not marked sold: ${soldErr.message}`);
      }
      const { error: elErr } = await supabase.from('ebay_listings').update({ status: 'sold', quantity: 0, updated_at: new Date().toISOString() }).eq('bike_id', bikeId);
      if (elErr) console.error(`eBay listing ${bikeId} not marked sold: ${elErr.message}`);
      let shopifyDone = false;
      try { shopifyDone = !!(await markBikeSoldOut(supabase, bikeId)); } catch (e) { console.warn('Shopify sold-out failed:', (e as Error).message); }
      const manualShopify = !!(bike as any).shopify_manual_listed_at;
      if (manualShopify) {
        await supabase.from('bikes').update({ shopify_delist_required_at: new Date().toISOString() }).eq('id', bikeId).is('shopify_delist_required_at', null);
      }
      const shopifyLine = manualShopify
        ? '<p><strong>Action needed: remove this bike from your Shopify store.</strong> It was listed there by CSV, so VeloDealer can\'t take it down for you. Once removed, press "Removed from Shopify" on the Listings page.</p>'
        : shopifyDone ? '<p>Its Shopify listing has been set to zero stock automatically.</p>' : '';

      const name = [(bike as any).reference, (bike as any).make, (bike as any).model].filter(Boolean).join(' ');
      await logBikeActivity(bikeId, {
        kind: 'sale',
        action: 'ebay_sold',
        summary: `Sold on eBay for ${currency === 'GBP' ? '£' : `${currency} `}${total.toLocaleString('en-GB')}`,
        detail: { order_id: orderId, buyer: order.buyer?.username ?? null, total, currency },
        actorLabel: 'eBay',
      }, businessId);
      await sendNotification(
        supabase,
        'ebay_sale',
        `Sold on eBay: ${name}`,
        `<p><strong>${esc(name)}</strong> has sold on eBay for ${esc(currency)} ${esc(total.toFixed(2))}.</p>
         <p>Order ${esc(orderId)} · buyer ${esc(order.buyer?.username ?? 'unknown')}.</p>
         ${shopifyLine}
         <p>The bike is now marked sold in VeloDealer. Record the sale invoice and mark the order despatched once it has gone.</p>`,
        businessId,
      );
    }
  }
  await saveSettings(supabase, businessId, { last_order_sync_at: startedAt }, true, conn.environment);
  return { businessId, processed };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const supabase = serviceClient();

  // Our own schedule syncs every dealership; a signed-in manager syncs only theirs.
  const scheduled = await isScheduledCall(req, supabase);
  let only: string | null = null;
  if (!scheduled) {
    try {
      const user = await requireUser(req, supabase);
      await requireRole(supabase, user.id, ['admin', 'owner']);
      only = await businessIdForUser(supabase, user.id);
    } catch {
      return json({ error: 'Not authorised' }, 401);
    }
    if (!only) return json({ error: 'Not authorised' }, 401);
  }

  let ids: string[] = [];
  if (only) ids = [only];
  else {
    const { data } = await supabase
      .from('integrations').select('business_id').eq('name', EBAY_INTEGRATION_NAME).eq('is_active', true)
      .not('business_id', 'is', null);
    ids = ((data ?? []) as any[]).map((r) => r.business_id);
  }

  const results = [];
  for (const id of ids) {
    try {
      results.push(await syncBusiness(supabase, id));
    } catch (e) {
      console.error(`eBay order sync failed for ${id}:`, (e as Error).message);
      await logSystemError(supabase, { source: 'ebay', message: `eBay order sync failed: ${(e as Error).message}`, businessId: id, detail: { operation: 'order_sync' } });
      results.push({ businessId: id, error: (e as Error).message });
    }
  }
  return json({ ok: true, results });
});
