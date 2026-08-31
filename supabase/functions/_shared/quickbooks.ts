// Shared QuickBooks Online helpers for edge functions.
import { createClient } from 'npm:@supabase/supabase-js@2';
import type { QboTaxCodeRef } from './quickbooks-tax.ts';

export const QBO_INTEGRATION_NAME = 'quickbooks';

export interface QboAccounts {
  stock?: string;
  cogs?: string;
  sales?: string;
  vat?: string;
  purchase_funding?: string;
  part_exchange?: string;
}


export interface QboSettings {
  realm_id?: string;
  refresh_token?: string;
  access_token?: string;
  access_token_expires_at?: string;
  accounts?: QboAccounts;
  tax_codes?: QboTaxCodeRef;
  connected_at?: string;
}

export function serviceClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );
}

export function qboEnv() {
  const env = (Deno.env.get('QUICKBOOKS_ENVIRONMENT') || 'sandbox').toLowerCase();
  return env === 'production' ? 'production' : 'sandbox';
}

export function qboApiBase() {
  return qboEnv() === 'production'
    ? 'https://quickbooks.api.intuit.com'
    : 'https://sandbox-quickbooks.api.intuit.com';
}

export function redirectUri() {
  return `${Deno.env.get('SUPABASE_URL')}/functions/v1/quickbooks-oauth`;
}

export async function loadIntegration(supabase: ReturnType<typeof serviceClient>) {
  const { data, error } = await supabase
    .from('integrations')
    .select('*')
    .eq('name', QBO_INTEGRATION_NAME)
    .maybeSingle();
  if (error) throw new Error(`Failed to load QuickBooks integration: ${error.message}`);
  return data;
}

export async function saveSettings(
  supabase: ReturnType<typeof serviceClient>,
  settings: QboSettings,
  isActive = true,
) {
  const existing = await loadIntegration(supabase);
  const merged = { ...(existing?.settings as QboSettings ?? {}), ...settings };
  if (existing) {
    const { error } = await supabase
      .from('integrations')
      .update({ settings: merged, is_active: isActive, updated_at: new Date().toISOString() })
      .eq('id', existing.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from('integrations').insert({
      name: QBO_INTEGRATION_NAME,
      display_name: 'QuickBooks Online',
      is_active: isActive,
      settings: merged,
    });
    if (error) throw new Error(error.message);
  }
  return merged;
}

async function refreshAccessToken(refreshToken: string) {
  const clientId = Deno.env.get('QUICKBOOKS_CLIENT_ID')!;
  const clientSecret = Deno.env.get('QUICKBOOKS_CLIENT_SECRET')!;
  const basic = btoa(`${clientId}:${clientSecret}`);
  const res = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`QuickBooks token refresh failed [${res.status}]: ${body}`);
  return JSON.parse(body) as {
    access_token: string;
    expires_in: number;
    refresh_token: string;
  };
}

/** Returns a valid access token + realm id, refreshing and persisting when needed. */
export async function getQboAuth(supabase: ReturnType<typeof serviceClient>) {
  const integration = await loadIntegration(supabase);
  const settings = (integration?.settings ?? {}) as QboSettings;
  if (!integration?.is_active || !settings.refresh_token || !settings.realm_id) {
    throw new Error('QuickBooks is not connected');
  }

  const expiresAt = settings.access_token_expires_at ? Date.parse(settings.access_token_expires_at) : 0;
  if (settings.access_token && expiresAt - Date.now() > 60_000) {
    return { accessToken: settings.access_token, realmId: settings.realm_id, settings };
  }

  const tokens = await refreshAccessToken(settings.refresh_token);
  const updated = await saveSettings(supabase, {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token || settings.refresh_token,
    access_token_expires_at: new Date(Date.now() + (tokens.expires_in - 60) * 1000).toISOString(),
  });
  return { accessToken: tokens.access_token, realmId: settings.realm_id, settings: updated as QboSettings };
}

export async function qboFetch(
  accessToken: string,
  realmId: string,
  path: string,
  init: RequestInit = {},
) {
  const url = `${qboApiBase()}/v3/company/${realmId}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(init.headers as Record<string, string> | undefined),
    },
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`QuickBooks request failed [${res.status}] ${path}: ${text}`);
    throw new Error(`QuickBooks request failed [${res.status}]: ${text}`);
  }
  return text ? JSON.parse(text) : null;
}

/** Validates the caller's JWT and returns their profile, or throws. */
export async function requireUser(req: Request, supabase: ReturnType<typeof serviceClient>) {
  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) throw new Error('Missing Authorization header');
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) throw new Error('Invalid or expired session');
  return data.user;
}
