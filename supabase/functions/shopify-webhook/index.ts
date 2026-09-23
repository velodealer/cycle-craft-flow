// Receives Shopify order webhooks (orders/paid, orders/cancelled, refunds/create)
// and keeps the matching VeloDealer bike in step.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { serviceClient, hmacBase64, timingSafeEqual, type Client } from '../_shared/shopify.ts';
import { markBikeSoldOut, pushBikeToShopify, recordListingError } from '../_shared/shopify-listing.ts';
import { logBikeActivity } from '../_shared/activity.ts';

const ok = (body: unknown = { ok: true }) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

async function bikesFromLineItems(supabase: Client, order: any) {
  const skus = (order?.line_items ?? [])
    .map((li: any) => ({ sku: String(li?.sku ?? '').trim(), price: Number(li?.price ?? 0) }))
    .filter((li: any) => li.sku);
  if (!skus.length) return [];
  const { data, error } = await supabase
    .from('bikes')
    .select('*')
    .in('reference', skus.map((s: any) => s.sku));
  if (error) {
    console.error('Bike lookup failed:', error.message);
    return [];
  }
  return (data ?? []).map((bike: any) => ({
    bike,
    price: skus.find((s: any) => s.sku === bike.reference)?.price ?? Number(bike.asking_price ?? 0),
  }));
}

async function findOrCreateCustomer(supabase: Client, order: any, businessId: string | null): Promise<string | null> {
  const customer = order?.customer ?? {};
  const address = order?.shipping_address ?? order?.billing_address ?? {};
  const name = [customer.first_name, customer.last_name].filter(Boolean).join(' ').trim()
    || address.name
    || order?.email
    || 'Shopify customer';
  const email = customer.email || order?.email || null;

  if (email) {
    const { data: existing } = await supabase
      .from('external_owners')
      .select('id')
      .eq('email', email)
      .maybeSingle();
    if (existing) return (existing as { id: string }).id;
  }

  const { data, error } = await supabase
    .from('external_owners')
    .insert({
      name,
      email,
      phone: customer.phone || address.phone || null,
      address: [address.address1, address.address2, address.city, address.zip, address.country]
        .filter(Boolean).join(', ') || null,
      business_id: businessId,
    })
    .select('id')
    .single();
  if (error) {
    console.error('Could not create customer from Shopify order:', error.message);
    return null;
  }
  return data.id;
}

async function handleOrderPaid(supabase: Client, order: any) {
  const matches = await bikesFromLineItems(supabase, order);
  if (!matches.length) {
    console.log('Shopify order has no matching VeloDealer bikes:', order?.name);
    return;
  }
  const customerId = await findOrCreateCustomer(supabase, order, matches[0]?.bike?.business_id ?? null);
  const soldAt = order?.processed_at || order?.created_at || new Date().toISOString();

  for (const { bike, price } of matches) {
    if (bike.status === 'sold') {
      console.log(`Bike ${bike.reference} already sold — skipping Shopify order ${order?.name}`);
      continue;
    }
    const gross = Number(price) || Number(bike.asking_price) || 0;
    let vatRegistered = true;
    if (bike.business_id) {
      const { data: vatSetting } = await supabase
        .from('app_settings')
        .select('value')
        .eq('business_id', bike.business_id)
        .eq('key', 'vat_registered')
        .maybeSingle();
      if (vatSetting && vatSetting.value === false) vatRegistered = false;
    }
    const isMargin = !vatRegistered || bike.finance_scheme === 'margin_scheme';
    const vatRate = isMargin ? 0 : 20;
    const net = isMargin ? gross : Number((gross / 1.2).toFixed(2));

    try {
      const { data: numberData, error: numberError } = await supabase.rpc('next_invoice_number');
      if (numberError) throw new Error(numberError.message);

      const { error: invoiceError } = await supabase.from('invoices').insert({
        invoice_number: numberData as string,
        bike_id: bike.id,
        external_customer_id: customerId,
        type: 'sale',
        total: gross,
        net,
        gross,
        sale_gross: gross,
        vat_rate: vatRate,
        status: 'paid',
        issued_at: soldAt,
        paid_at: soldAt,
        business_id: bike.business_id,
      });
      if (invoiceError) throw new Error(invoiceError.message);

      const { error: bikeError } = await supabase
        .from('bikes')
        .update({
          status: 'sold',
          sale_price: gross,
          sold_at: soldAt,
          condition_notes: `${bike.condition_notes ? `${bike.condition_notes}\n\n` : ''}Sold via Shopify order ${order?.name ?? ''}`.trim(),
        })
        .eq('id', bike.id);
      if (bikeError) throw new Error(bikeError.message);

      await markBikeSoldOut(supabase, bike.id).catch((e) =>
        console.error('Shopify stock update failed:', (e as Error).message));

      await logBikeActivity(bike.id, {
        kind: 'sale',
        action: 'sold',
        summary: `Sold via Shopify order ${order?.name ?? ''}`.trim(),
        detail: { gross, invoice_number: numberData as string },
        actorLabel: 'Shopify',
      }, bike.business_id);

      console.log(`Bike ${bike.reference} marked sold from Shopify order ${order?.name}`);
    } catch (e) {
      console.error(`Shopify order handling failed for ${bike.reference}:`, (e as Error).message);
      await recordListingError(supabase, bike.id, (e as Error).message);
    }
  }
}

async function handleOrderReversed(supabase: Client, order: any) {
  const matches = await bikesFromLineItems(supabase, order);
  for (const { bike } of matches) {
    if (bike.status !== 'sold') continue;

    const { data: invoice } = await supabase
      .from('invoices')
      .select('id, quickbooks_invoice_id')
      .eq('bike_id', bike.id)
      .eq('type', 'sale')
      .order('created_at', { ascending: false })
      .maybeSingle();

    if (invoice && (invoice as any).quickbooks_invoice_id) {
      await recordListingError(
        supabase,
        bike.id,
        'Shopify order was cancelled or refunded, but the invoice is already in QuickBooks — reverse the sale manually.',
      );
      console.log(`Bike ${bike.reference}: refund needs manual reversal (already in QuickBooks)`);
      continue;
    }

    if (invoice) await supabase.from('invoices').delete().eq('id', (invoice as any).id);

    await supabase
      .from('bikes')
      .update({ status: 'listed', sale_price: null, sold_at: null })
      .eq('id', bike.id);

    await logBikeActivity(bike.id, {
      kind: 'sale',
      action: 'reversed',
      summary: `Shopify order ${order?.name ?? ''} cancelled or refunded — bike back on sale`.trim(),
      actorLabel: 'Shopify',
    }, bike.business_id);

    try {
      await pushBikeToShopify(supabase, bike as any, 1);
    } catch (e) {
      console.error('Shopify relist failed:', (e as Error).message);
      await recordListingError(supabase, bike.id, (e as Error).message);
    }
    console.log(`Bike ${bike.reference} put back on sale after Shopify cancellation/refund`);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const raw = await req.text();
  const topic = req.headers.get('x-shopify-topic') ?? '';
  const signature = req.headers.get('x-shopify-hmac-sha256') ?? '';
  const secret = Deno.env.get('SHOPIFY_CLIENT_SECRET') || Deno.env.get('SHOPIFY_WEBHOOK_SECRET');

  if (!secret) {
    console.error('Shopify webhook secret is not configured');
    return new Response('Not configured', { status: 500 });
  }

  const expected = await hmacBase64(secret, raw);
  if (!timingSafeEqual(expected, signature)) {
    console.error(`Shopify webhook rejected: bad signature (topic ${topic})`);
    return new Response('Invalid signature', { status: 401 });
  }

  console.log(`Shopify webhook received: ${topic}`);

  let payload: any;
  try {
    payload = JSON.parse(raw);
  } catch {
    return ok({ ok: true, ignored: 'unparseable body' });
  }

  const supabase = serviceClient();

  try {
    if (topic === 'orders/paid') {
      await handleOrderPaid(supabase, payload);
    } else if (topic === 'orders/cancelled') {
      await handleOrderReversed(supabase, payload);
    } else if (topic === 'app/uninstalled') {
      const shop = String(req.headers.get('x-shopify-shop-domain') || payload?.myshopify_domain || '').toLowerCase();
      if (shop) {
        const { data: rows } = await supabase.from('integrations').select('id, settings').eq('name', 'shopify');
        for (const r of rows ?? []) {
          const st = (r.settings ?? {}) as Record<string, unknown>;
          if (String(st.shop_domain || '').toLowerCase() !== shop) continue;
          const { access_token: _t, ...rest } = st;
          await supabase.from('integrations')
            .update({ is_active: false, settings: { ...rest, uninstalled_at: new Date().toISOString() } })
            .eq('id', r.id);
        }
        console.log(`Shopify app uninstalled by ${shop}`);
      }
    } else if (topic === 'refunds/create') {
      const orderId = payload?.order_id;
      const lineItems = (payload?.refund_line_items ?? []).map((r: any) => r.line_item).filter(Boolean);
      await handleOrderReversed(supabase, { name: `refund for order ${orderId}`, line_items: lineItems });
    } else {
      console.log(`Ignoring Shopify topic ${topic}`);
    }
  } catch (e) {
    console.error('Shopify webhook handling failed:', (e as Error).message);
  }

  return ok();
});
