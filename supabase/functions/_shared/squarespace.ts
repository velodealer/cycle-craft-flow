// Squarespace OAuth + API helpers. One connection per dealership, stored in
// public.integrations (name 'squarespace', business_id). Tokens never leave the server.
import { createClient } from 'npm:@supabase/supabase-js@2';

export const SQS_NAME = 'squarespace';
export const SQS_SCOPES = 'website.products,website.inventory,website.orders.read';
export const SQS_LOGIN = 'https://login.squarespace.com/api/1/login/oauth/provider';
export const SQS_API = 'https://api.squarespace.com';
const UA = 'VeloDealer/1.0 (+https://velodealer.com)';

export interface SqsSettings {
  access_token?: string;
  access_token_expires_at?: number; // epoch ms
  refresh_token?: string;
  website_id?: string;
  website_title?: string;
  website_url?: string;
  store_page_id?: string;
  store_page_title?: string;
  currency?: string;
  webhook_id?: string;
  webhook_secret?: string;
  connected_at?: string;
}

export type Client = ReturnType<typeof serviceClient>;

export function serviceClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } },
  );
}

export function functionsBase() {
  return (Deno.env.get('PUBLIC_FUNCTIONS_BASE_URL') || `${Deno.env.get('SUPABASE_URL')}/functions/v1`).replace(/\/$/, '');
}
export const redirectUri = () => `${functionsBase()}/squarespace-oauth`;
export const webhookUrl = () => `${functionsBase()}/squarespace-webhook`;

function basicAuth() {
  const id = Deno.env.get('SQUARESPACE_CLIENT_ID');
  const secret = Deno.env.get('SQUARESPACE_CLIENT_SECRET');
  if (!id || !secret) throw new Error('Squarespace app credentials are not configured');
  return `Basic ${btoa(`${id}:${secret}`)}`;
}

export async function tokenRequest(body: Record<string, string>) {
  const res = await fetch(`${SQS_LOGIN}/tokens`, {
    method: 'POST',
    headers: { Authorization: basicAuth(), 'Content-Type': 'application/json', 'User-Agent': UA },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Squarespace sign-in failed [${res.status}]: ${text.slice(0, 300)}`);
  const t = JSON.parse(text);
  return {
    access_token: t.access_token as string,
    refresh_token: (t.refresh_token as string) || undefined,
    access_token_expires_at: t.access_token_expires_at
      ? Math.round(Number(t.access_token_expires_at) * 1000)
      : Date.now() + 25 * 60 * 1000,
  };
}

export async function revokeToken(token: string) {
  await fetch(`${SQS_LOGIN}/revoke_token`, {
    method: 'POST',
    headers: { Authorization: basicAuth(), 'Content-Type': 'application/json', 'User-Agent': UA },
    body: JSON.stringify({ token }),
  }).catch(() => undefined);
}

export async function businessIdForUser(supabase: Client, userId: string): Promise<string> {
  const { data } = await supabase.from('profiles').select('business_id').eq('user_id', userId).maybeSingle();
  if (!data?.business_id) throw new Error('Could not work out which dealership you belong to');
  return data.business_id as string;
}

export async function businessIdForBike(supabase: Client, bikeId: string): Promise<string> {
  const { data, error } = await supabase.from('bikes').select('business_id').eq('id', bikeId).maybeSingle();
  if (error) throw new Error(`Could not load bike: ${error.message}`);
  if (!data?.business_id) throw new Error('Bike not found');
  return data.business_id as string;
}

export async function loadIntegration(supabase: Client, businessId: string) {
  const { data, error } = await supabase.from('integrations').select('*')
    .eq('name', SQS_NAME).eq('business_id', businessId).maybeSingle();
  if (error) throw new Error(error.message);
  return data as { id: string; is_active: boolean; settings: SqsSettings } | null;
}

export async function saveSettings(supabase: Client, businessId: string, patch: SqsSettings, isActive = true) {
  const existing = await loadIntegration(supabase, businessId);
  const merged = { ...(existing?.settings ?? {}), ...patch };
  if (existing) {
    const { error } = await supabase.from('integrations')
      .update({ settings: merged, is_active: isActive, updated_at: new Date().toISOString() })
      .eq('id', existing.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from('integrations').insert({
      name: SQS_NAME, display_name: 'Squarespace', is_active: isActive, business_id: businessId, settings: merged,
    });
    if (error) throw new Error(error.message);
  }
  return merged as SqsSettings;
}

/** Returns a valid access token, refreshing it when it's within 2 minutes of expiry. */
export async function accessToken(supabase: Client, businessId: string): Promise<{ token: string; settings: SqsSettings }> {
  const row = await loadIntegration(supabase, businessId);
  const s = row?.settings ?? {};
  if (!row?.is_active || !s.access_token) throw new Error('Squarespace is not connected. Connect it under Settings → Integrations.');
  if ((s.access_token_expires_at ?? 0) - Date.now() > 120_000) return { token: s.access_token, settings: s };
  if (!s.refresh_token) throw new Error('Squarespace sign-in has expired. Please reconnect Squarespace.');
  const t = await tokenRequest({ grant_type: 'refresh_token', refresh_token: s.refresh_token });
  const next = await saveSettings(supabase, businessId, {
    access_token: t.access_token,
    access_token_expires_at: t.access_token_expires_at,
    refresh_token: t.refresh_token ?? s.refresh_token,
  });
  return { token: t.access_token, settings: next };
}

export async function sqsFetch<T = any>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'User-Agent': UA,
    ...(init.body && !(init.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
    ...(init.headers as Record<string, string> ?? {}),
  };
  const res = await fetch(`${SQS_API}${path}`, { ...init, headers });
  const text = await res.text();
  if (!res.ok) {
    let msg = text;
    try { const j = JSON.parse(text); msg = j.message || j.error || text; } catch { /* keep */ }
    throw new Error(`Squarespace request failed [${res.status}]: ${String(msg).slice(0, 400)}`);
  }
  return (text ? JSON.parse(text) : {}) as T;
}

export async function requireUser(req: Request, supabase: Client) {
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) throw new Error('Missing Authorization header');
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) throw new Error('Invalid or expired session');
  return data.user;
}

export async function requireRole(supabase: Client, userId: string, roles: string[]) {
  const { data } = await supabase.from('profiles').select('role').eq('user_id', userId).maybeSingle();
  const role = (data as { role?: string } | null)?.role;
  if (!role || !roles.includes(role)) throw new Error('You do not have permission to do that');
  return role;
}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
}

/** Squarespace signs webhook bodies with HMAC-SHA256; the secret is hex-encoded. */
export async function verifySignature(secretHex: string, body: string, signature: string) {
  const key = await crypto.subtle.importKey('raw', hexToBytes(secretHex) as BufferSource, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body)));
  const expected = Array.from(sig).map((b) => b.toString(16).padStart(2, '0')).join('');
  const got = signature.trim().toLowerCase();
  if (expected.length !== got.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ got.charCodeAt(i);
  return diff === 0;
}
