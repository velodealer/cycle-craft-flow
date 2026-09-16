// Shared Shopify helpers for edge functions.
import { createClient } from 'npm:@supabase/supabase-js@2';

export const SHOPIFY_INTEGRATION_NAME = 'shopify';
export const SHOPIFY_API_VERSION = '2025-01';
export const SHOPIFY_SCOPES =
  'write_products,read_products,write_inventory,read_inventory,read_orders,read_locations';

export interface ShopifySettings {
  shop_domain?: string;
  access_token?: string;
  scope?: string;
  shop_name?: string;
  location_id?: string;
  connected_at?: string;
  auto_list?: boolean;
  product_type?: string;
  vendor?: string;
  publication_id?: string;
}

export type Client = ReturnType<typeof serviceClient>;

export function serviceClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );
}

export function redirectUri() {
  return `${Deno.env.get('SUPABASE_URL')}/functions/v1/shopify-oauth`;
}

export function webhookUrl() {
  return `${Deno.env.get('SUPABASE_URL')}/functions/v1/shopify-webhook`;
}

/** Normalises user input like "my-shop" or "https://my-shop.myshopify.com/admin". */
export function normaliseShopDomain(input: string): string {
  let value = String(input || '').trim().toLowerCase();
  value = value.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  if (!value) throw new Error('Enter your Shopify store address');
  if (!value.includes('.')) value = `${value}.myshopify.com`;
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(value)) {
    throw new Error('That does not look like a Shopify store address (example: my-shop.myshopify.com)');
  }
  return value;
}

export async function loadIntegration(supabase: Client) {
  const { data, error } = await supabase
    .from('integrations')
    .select('*')
    .eq('name', SHOPIFY_INTEGRATION_NAME)
    .maybeSingle();
  if (error) throw new Error(`Failed to load Shopify integration: ${error.message}`);
  return data;
}

export async function loadSettings(supabase: Client): Promise<ShopifySettings> {
  const row = await loadIntegration(supabase);
  return ((row?.settings ?? {}) as ShopifySettings) || {};
}

export async function saveSettings(
  supabase: Client,
  settings: ShopifySettings,
  isActive = true,
): Promise<ShopifySettings> {
  const existing = await loadIntegration(supabase);
  const merged = { ...((existing?.settings as ShopifySettings) ?? {}), ...settings };
  if (existing) {
    const { error } = await supabase
      .from('integrations')
      .update({ settings: merged, is_active: isActive, updated_at: new Date().toISOString() })
      .eq('id', (existing as { id: string }).id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from('integrations').insert({
      name: SHOPIFY_INTEGRATION_NAME,
      display_name: 'Shopify',
      is_active: isActive,
      settings: merged,
    });
    if (error) throw new Error(error.message);
  }
  return merged;
}

export async function requireConnection(supabase: Client) {
  const settings = await loadSettings(supabase);
  if (!settings.access_token || !settings.shop_domain) {
    throw new Error('Shopify is not connected — connect your store in Settings → Integrations.');
  }
  return settings as ShopifySettings & { access_token: string; shop_domain: string };
}

/** Admin GraphQL call. Throws with Shopify's own message on failure. */
export async function shopifyGraphql<T = any>(
  settings: { shop_domain: string; access_token: string },
  query: string,
  variables: Record<string, unknown> = {},
): Promise<T> {
  const res = await fetch(
    `https://${settings.shop_domain}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': settings.access_token,
      },
      body: JSON.stringify({ query, variables }),
    },
  );
  const text = await res.text();
  if (!res.ok) {
    console.error(`Shopify request failed [${res.status}]: ${text}`);
    throw new Error(`Shopify request failed [${res.status}]: ${text}`);
  }
  const body = text ? JSON.parse(text) : {};
  if (body.errors?.length) {
    const message = body.errors.map((e: any) => e.message).join('; ');
    console.error('Shopify GraphQL errors:', message);
    throw new Error(`Shopify error: ${message}`);
  }
  return body.data as T;
}

type Conn = { shop_domain: string; access_token: string };

const numericId = (gid: string) => String(gid).split('/').pop() as string;

/** Shop display name via the GraphQL Admin API. */
export async function fetchShopName(conn: Conn): Promise<string> {
  const data = await shopifyGraphql<{ shop: { name: string } }>(conn, `{ shop { name } }`);
  return data?.shop?.name || conn.shop_domain;
}

/** Active locations via the GraphQL Admin API. */
export async function fetchLocations(
  conn: Conn,
): Promise<Array<{ id: string; name: string; active: boolean }>> {
  const data = await shopifyGraphql<{
    locations: { nodes: Array<{ id: string; name: string; isActive: boolean }> };
  }>(conn, `{ locations(first: 50) { nodes { id name isActive } } }`);
  return (data?.locations?.nodes ?? []).map((l) => ({
    id: numericId(l.id),
    name: l.name,
    active: Boolean(l.isActive),
  }));
}

const TOPIC_ENUM: Record<string, string> = {
  'orders/paid': 'ORDERS_PAID',
  'orders/cancelled': 'ORDERS_CANCELLED',
  'refunds/create': 'REFUNDS_CREATE',
};

/** Creates any missing webhook subscriptions via the GraphQL Admin API. */
export async function ensureWebhooks(conn: Conn, topics: string[], callbackUrl: string) {
  let existing: Array<{ topic: string; endpoint?: { callbackUrl?: string } }> = [];
  try {
    const data = await shopifyGraphql<{
      webhookSubscriptions: {
        nodes: Array<{ topic: string; endpoint: { callbackUrl?: string } }>;
      };
    }>(
      conn,
      `{ webhookSubscriptions(first: 100) {
           nodes { topic endpoint { ... on WebhookHttpEndpoint { callbackUrl } } }
         } }`,
    );
    existing = data?.webhookSubscriptions?.nodes ?? [];
  } catch (e) {
    console.error('Could not list Shopify webhooks:', (e as Error).message);
  }

  const mutation = `mutation CreateWebhook($topic: WebhookSubscriptionTopic!, $sub: WebhookSubscriptionInput!) {
    webhookSubscriptionCreate(topic: $topic, webhookSubscription: $sub) {
      userErrors { field message }
    }
  }`;

  for (const topic of topics) {
    const enumTopic = TOPIC_ENUM[topic];
    if (!enumTopic) continue;
    if (existing.some((w) => w.topic === enumTopic && w.endpoint?.callbackUrl === callbackUrl)) continue;
    try {
      const res = await shopifyGraphql<{
        webhookSubscriptionCreate: { userErrors: Array<{ message: string }> };
      }>(conn, mutation, {
        topic: enumTopic,
        sub: { callbackUrl, format: 'JSON' },
      });
      const errors = res?.webhookSubscriptionCreate?.userErrors ?? [];
      if (errors.length) {
        console.error(`Shopify webhook ${topic} not created:`, errors.map((e) => e.message).join('; '));
      }
    } catch (e) {
      console.error(`Could not register Shopify webhook ${topic}:`, (e as Error).message);
    }
  }
}

/** Validates the caller's JWT and returns their user, or throws. */
export async function requireUser(req: Request, supabase: Client) {
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) throw new Error('Missing Authorization header');
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) throw new Error('Invalid or expired session');
  return data.user;
}

export async function requireRole(supabase: Client, userId: string, roles: string[]) {
  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !data) throw new Error('Could not load your profile');
  const role = (data as { role: string }).role;
  if (!roles.includes(role)) throw new Error('You do not have permission to do that');
  return role;
}

/** Hex HMAC-SHA256 used by Shopify's OAuth callback query signature. */
export async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Base64 HMAC-SHA256 used by Shopify webhooks. */
export async function hmacBase64(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
