// Shopify mandatory compliance webhooks for public apps:
//   customers/data_request, customers/redact, shop/redact
// Also handles app/uninstalled so a store that removes the app is disconnected here.
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

/** Clears the stored connection + listing references for a shop that removed us. */
async function disconnectShop(supabase: Client, shopDomain: string) {
  const row = await loadIntegration(supabase);
  const settings = ((row?.settings ?? {}) as ShopifySettings) || {};
  if (!row || !settings.shop_domain || settings.shop_domain !== shopDomain) {
    console.log(`Redact/uninstall for ${shopDomain} did not match the stored store — nothing to clear.`);
    return;
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

  try {
    switch (topic) {
      case 'customers/data_request':
        // VeloDealer stores no Shopify customer profiles beyond order-derived
        // contact details already visible to the merchant in their own admin.
        console.log('Customer data request acknowledged', {
          shop: shopDomain,
          customer: payload?.customer?.id ?? null,
        });
        break;
      case 'customers/redact': {
        const email = String(payload?.customer?.email ?? '').trim().toLowerCase();
        if (email) {
          const { error } = await supabase_redactCustomer(email);
          if (error) console.error('Customer redact failed:', error);
        }
        break;
      }
      case 'shop/redact':
      case 'app/uninstalled':
        if (shopDomain) await disconnectShop(serviceClient(), shopDomain);
        break;
      default:
        console.log(`Unhandled compliance topic: ${topic}`);
    }
  } catch (e) {
    console.error('Compliance handler error:', (e as Error).message);
  }

  return json({ ok: true });
});

/** Removes contact details for a customer Shopify asked us to erase. */
async function supabase_redactCustomer(email: string): Promise<{ error?: string }> {
  const supabase = serviceClient();
  const { error } = await supabase
    .from('external_owners')
    .update({ email: null, phone: null, address: null, name: 'Redacted customer' })
    .eq('email', email);
  return { error: error?.message };
}
