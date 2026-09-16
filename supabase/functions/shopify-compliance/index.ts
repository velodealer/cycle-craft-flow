// Shopify mandatory compliance webhooks for public apps:
//   customers/data_request, customers/redact, shop/redact
// Also handles app/uninstalled so a store that removes the app is disconnected here.
// These three compliance endpoints are configured in the Partner Dashboard app
// configuration — they cannot be registered through the Admin API.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import {
  serviceClient,
  hmacBase64,
  timingSafeEqual,
  loadIntegration,
  type Client,
  type ShopifySettings,
} from '../_shared/shopify.ts';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

function webhookSecret(): string | null {
  return Deno.env.get('SHOPIFY_CLIENT_SECRET') || Deno.env.get('SHOPIFY_WEBHOOK_SECRET') || null;
}

/** Audit trail of every compliance request Shopify sends us. */
async function logEvent(
  supabase: Client,
  topic: string,
  shopDomain: string,
  summary: Record<string, unknown>,
  outcome: string,
) {
  const { error } = await supabase.from('shopify_compliance_events').insert({
    topic,
    shop_domain: shopDomain || null,
    payload_summary: summary,
    outcome,
  });
  if (error) console.error('Could not log compliance event:', error.message);
}

/** Clears the stored connection + listing references for a shop that removed us. */
async function disconnectShop(supabase: Client, shopDomain: string): Promise<string> {
  const row = await loadIntegration(supabase);
  const settings = ((row?.settings ?? {}) as ShopifySettings) || {};
  if (!row || !settings.shop_domain || settings.shop_domain !== shopDomain) {
    console.log(`Redact/uninstall for ${shopDomain} did not match the stored store — nothing to clear.`);
    return 'no_matching_store';
  }

  const cleared: ShopifySettings = {
    shop_domain: settings.shop_domain,
    shop_name: settings.shop_name,
    auto_list: false,
  };
  const { error } = await supabase
    .from('integrations')
    .update({ settings: cleared, is_active: false, updated_at: new Date().toISOString() })
    .eq('id', (row as { id: string }).id);
  if (error) console.error('Could not clear Shopify integration:', error.message);

  const { error: listErr } = await supabase
    .from('shopify_listings')
    .update({
      product_id: null,
      variant_id: null,
      inventory_item_id: null,
      location_id: null,
      product_url: null,
      status: 'not_listed',
      quantity: 0,
      last_error: null,
      last_synced_at: new Date().toISOString(),
    })
    .eq('shop_domain', shopDomain);
  if (listErr) console.error('Could not clear Shopify listings:', listErr.message);

  return error || listErr ? 'partial_error' : 'disconnected';
}

/** Removes contact details for a customer Shopify asked us to erase. */
async function redactCustomer(supabase: Client, email: string, phone: string): Promise<string> {
  let touched = 0;
  const redacted = {
    email: null as string | null,
    phone: null as string | null,
    address: null as string | null,
    name: 'Redacted customer',
  };

  if (email) {
    const { data, error } = await supabase
      .from('external_owners')
      .update(redacted)
      .eq('email', email)
      .select('id');
    if (error) console.error('Customer redact (email) failed:', error.message);
    touched += data?.length ?? 0;
  }
  if (phone) {
    const { data, error } = await supabase
      .from('external_owners')
      .update(redacted)
      .eq('phone', phone)
      .select('id');
    if (error) console.error('Customer redact (phone) failed:', error.message);
    touched += data?.length ?? 0;
  }

  if (email) {
    const { error } = await supabase
      .from('typeform_submissions')
      .update({ customer_email: null, customer_phone: null, customer_name: 'Redacted customer' })
      .eq('customer_email', email);
    if (error) console.error('Submission redact failed:', error.message);
  }

  return `redacted:${touched}`;
}

async function handle(topic: string, shopDomain: string, payload: any) {
  const supabase = serviceClient();
  try {
    switch (topic) {
      case 'customers/data_request': {
        // VeloDealer stores no Shopify customer profiles beyond order-derived
        // contact details already visible to the merchant in their own admin.
        await logEvent(
          supabase,
          topic,
          shopDomain,
          { customer_id: payload?.customer?.id ?? null, orders: payload?.orders_requested ?? [] },
          'acknowledged_no_stored_data',
        );
        break;
      }
      case 'customers/redact': {
        const email = String(payload?.customer?.email ?? '').trim().toLowerCase();
        const phone = String(payload?.customer?.phone ?? '').trim();
        const outcome = await redactCustomer(supabase, email, phone);
        await logEvent(supabase, topic, shopDomain, { customer_id: payload?.customer?.id ?? null }, outcome);
        break;
      }
      case 'shop/redact':
      case 'app/uninstalled': {
        const outcome = shopDomain ? await disconnectShop(supabase, shopDomain) : 'no_shop_domain';
        await logEvent(supabase, topic, shopDomain, { shop_id: payload?.shop_id ?? null }, outcome);
        break;
      }
      default:
        await logEvent(supabase, topic || 'unknown', shopDomain, {}, 'unhandled_topic');
    }
  } catch (e) {
    console.error('Compliance handler error:', (e as Error).message);
    try {
      await logEvent(supabase, topic || 'unknown', shopDomain, {}, `error:${(e as Error).message}`);
    } catch (_) {
      // logging is best-effort
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const raw = await req.text();
  const secret = webhookSecret();
  const provided = req.headers.get('x-shopify-hmac-sha256') || '';
  if (!secret) {
    console.error('Shopify compliance webhook received but no signing secret is configured.');
    return json({ error: 'Not configured' }, 401);
  }
  const expected = await hmacBase64(secret, raw);
  if (!provided || !timingSafeEqual(provided, expected)) {
    console.error('Shopify compliance webhook rejected: bad signature');
    return json({ error: 'Invalid signature' }, 401);
  }

  const topic = (req.headers.get('x-shopify-topic') || '').toLowerCase();
  const shopDomain = (req.headers.get('x-shopify-shop-domain') || '').toLowerCase();
  let payload: any = {};
  try {
    payload = raw ? JSON.parse(raw) : {};
  } catch {
    payload = {};
  }

  console.log(`Shopify compliance webhook: ${topic} for ${shopDomain}`);

  // Answer Shopify immediately; do the work in the background.
  const task = handle(topic, shopDomain, payload);
  try {
    // @ts-ignore EdgeRuntime is provided by the Supabase runtime
    EdgeRuntime.waitUntil(task);
  } catch {
    await task;
  }

  return json({ ok: true });
});
