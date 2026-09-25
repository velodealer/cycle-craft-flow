// Shared Xero helpers for edge functions. One Xero organisation per dealership.
import { createClient } from 'npm:@supabase/supabase-js@2';

export const XERO_INTEGRATION_NAME = 'xero';
export const XERO_SCOPES = [
  'openid', 'profile', 'email', 'offline_access',
  'accounting.settings', 'accounting.transactions', 'accounting.contacts',
].join(' ');
const TOKEN_URL = 'https://identity.xero.com/connect/token';
const API_BASE = 'https://api.xero.com/api.xro/2.0';

/** Account CODES in the dealer's Xero chart of accounts. */
export interface XeroAccounts {
  stock?: string;
  /** Optional: kept parts are moved here when a bike is broken. Falls back to stock. */
  parts_stock?: string;
  cogs?: string;
  sales?: string;
  vat?: string;
  purchase_funding?: string;
}
/** Xero TaxType values (e.g. OUTPUT2, NONE). */
export interface XeroTaxTypes {
  standard_sales?: string;
  margin_sales?: string;
}
export interface XeroSettings {
  tenant_id?: string;
  tenant_name?: string;
  refresh_token?: string;
  access_token?: string;
  access_token_expires_at?: string;
  connected_at?: string;
  accounts?: XeroAccounts;
  tax_types?: XeroTaxTypes;
  auth_error?: string;
  health?: { missing_accounts: string[]; missing_tax_types: string[]; checked_at: string };
}

export class XeroReconnectRequired extends Error {
  constructor(message: string) { super(message); this.name = 'XeroReconnectRequired'; }
}

export type Client = ReturnType<typeof serviceClient>;

export function serviceClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );
}

export function functionsBase() {
  return (
    Deno.env.get('PUBLIC_FUNCTIONS_BASE_URL') || `${Deno.env.get('SUPABASE_URL')}/functions/v1`
  ).trim().replace(/\/+$/, '');
}
export const redirectUri = () => `${functionsBase()}/xero-oauth`;

export function xeroCredentials() {
  const id = Deno.env.get('XERO_CLIENT_ID');
  const secret = Deno.env.get('XERO_CLIENT_SECRET');
  if (!id || !secret) throw new Error('Xero app keys are not configured yet');
  return { id, secret, basic: btoa(`${id}:${secret}`) };
}

export async function requireUser(req: Request, supabase: Client) {
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) throw new Error('Missing Authorization header');
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) throw new Error('Invalid or expired session');
  return data.user;
}

export async function profileFor(supabase: Client, userId: string) {
  const { data, error } = await supabase.from('profiles').select('id, role, business_id').eq('user_id', userId).maybeSingle();
  if (error || !data?.business_id) throw new Error('Could not work out which dealership you belong to');
  return data as { id: string; role: string; business_id: string };
}

export async function loadIntegration(supabase: Client, businessId: string) {
  const { data, error } = await supabase
    .from('integrations').select('*')
    .eq('name', XERO_INTEGRATION_NAME).eq('business_id', businessId).maybeSingle();
  if (error) throw new Error(`Failed to load Xero integration: ${error.message}`);
  return data as { id: string; is_active: boolean; settings: XeroSettings } | null;
}

export async function saveSettings(supabase: Client, businessId: string, patch: XeroSettings, isActive = true): Promise<XeroSettings> {
  const existing = await loadIntegration(supabase, businessId);
  const merged = { ...(existing?.settings ?? {}), ...patch } as XeroSettings;
  for (const k of Object.keys(merged) as (keyof XeroSettings)[]) if (merged[k] === undefined) delete merged[k];
  if (existing) {
    const { error } = await supabase.from('integrations')
      .update({ settings: merged, is_active: isActive, updated_at: new Date().toISOString() })
      .eq('id', existing.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from('integrations').insert({
      name: XERO_INTEGRATION_NAME, display_name: 'Xero', is_active: isActive, business_id: businessId, settings: merged,
    });
    if (error) throw new Error(error.message);
  }
  return merged;
}

export async function tokenRequest(params: Record<string, string>) {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { Authorization: `Basic ${xeroCredentials().basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
  });
  const text = await res.text();
  if (!res.ok) {
    if (text.includes('invalid_grant')) throw new XeroReconnectRequired('Xero sign-in has expired — reconnect Xero in Settings → Integrations.');
    throw new Error(`Xero token request failed [${res.status}]: ${text}`);
  }
  return JSON.parse(text) as { access_token: string; refresh_token: string; expires_in: number; id_token?: string };
}

export interface XeroAuth { accessToken: string; tenantId: string; settings: XeroSettings }

/** Valid token for a dealership. Xero rotates refresh tokens, so the new one is always saved. */
export async function getXeroAuth(supabase: Client, businessId: string, force = false): Promise<XeroAuth> {
  const row = await loadIntegration(supabase, businessId);
  const s = row?.settings ?? {};
  if (!row?.is_active || !s.refresh_token) throw new Error('Xero is not connected');
  if (!s.tenant_id) throw new Error('Choose which Xero organisation to use in Settings → Integrations → Xero.');
  const exp = s.access_token_expires_at ? Date.parse(s.access_token_expires_at) : 0;
  if (!force && s.access_token && exp - Date.now() > 60_000) return { accessToken: s.access_token, tenantId: s.tenant_id, settings: s };
  try {
    const t = await tokenRequest({ grant_type: 'refresh_token', refresh_token: s.refresh_token });
    const updated = await saveSettings(supabase, businessId, {
      access_token: t.access_token,
      refresh_token: t.refresh_token || s.refresh_token,
      access_token_expires_at: new Date(Date.now() + t.expires_in * 1000).toISOString(),
      auth_error: undefined,
    });
    return { accessToken: t.access_token, tenantId: s.tenant_id, settings: updated };
  } catch (e) {
    if (e instanceof XeroReconnectRequired) await saveSettings(supabase, businessId, { auth_error: e.message }, false);
    throw e;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Pulls readable validation messages out of a Xero error body. */
export function xeroMessage(text: string): string {
  try {
    const b = JSON.parse(text);
    const msgs: string[] = [];
    for (const el of b.Elements ?? []) for (const v of el.ValidationErrors ?? []) if (v.Message) msgs.push(v.Message);
    if (msgs.length) return [...new Set(msgs)].join('; ');
    return b.Detail || b.Message || b.Title || text;
  } catch { return text; }
}

/** Raw Xero Accounting API call with 429 back-off. */
export async function xeroFetch(auth: { accessToken: string; tenantId: string }, path: string, init: RequestInit = {}, attempt = 0): Promise<any> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${auth.accessToken}`,
      'xero-tenant-id': auth.tenantId,
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers as Record<string, string> | undefined),
    },
  });
  const text = await res.text();
  if (res.status === 429 && attempt < 2) {
    const wait = Math.min(Number(res.headers.get('Retry-After') || 2), 10) * 1000;
    await sleep(wait);
    return xeroFetch(auth, path, init, attempt + 1);
  }
  if (!res.ok) {
    console.error(`Xero request failed [${res.status}] ${path}: ${text}`);
    const err = new Error(`Xero request failed [${res.status}]: ${xeroMessage(text)}`) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return text ? JSON.parse(text) : null;
}

/** Authenticated call for a dealership; on 401 forces one refresh and retries. */
export async function xeroFetchFor(supabase: Client, businessId: string, path: string, init: RequestInit = {}) {
  const auth = await getXeroAuth(supabase, businessId);
  try {
    return await xeroFetch(auth, path, init);
  } catch (e) {
    if ((e as { status?: number }).status !== 401) throw e;
    return await xeroFetch(await getXeroAuth(supabase, businessId, true), path, init);
  }
}

/** Finds a contact by exact name, or creates it. */
export async function findOrCreateContact(
  call: (path: string, init?: RequestInit) => Promise<any>,
  c: { name: string; email?: string | null; phone?: string | null; address?: string | null },
): Promise<string> {
  const name = c.name.trim().slice(0, 255);
  const where = encodeURIComponent(`Name=="${name.replace(/"/g, '\\"')}"`);
  const found = await call(`/Contacts?where=${where}`);
  const hit = found?.Contacts?.find((x: any) => x.ContactStatus !== 'ARCHIVED');
  if (hit?.ContactID) return hit.ContactID;
  const created = await call('/Contacts', {
    method: 'POST',
    body: JSON.stringify({ Contacts: [{
      Name: name,
      ...(c.email ? { EmailAddress: c.email } : {}),
      ...(c.phone ? { Phones: [{ PhoneType: 'DEFAULT', PhoneNumber: c.phone }] } : {}),
      ...(c.address ? { Addresses: [{ AddressType: 'STREET', AddressLine1: c.address.slice(0, 500) }] } : {}),
    }] }),
  });
  const id = created?.Contacts?.[0]?.ContactID;
  if (!id) throw new Error('Xero did not return the new contact');
  return id;
}

/** Whether the business is VAT registered (defaults to yes). Fails loudly on read error. */
export async function isVatRegistered(supabase: Client, businessId: string | null): Promise<boolean> {
  if (!businessId) return true;
  const { data, error } = await supabase.from('app_settings').select('value')
    .eq('business_id', businessId).eq('key', 'vat_registered').maybeSingle();
  if (error) throw new Error(`Could not read VAT registration setting: ${error.message}`);
  return !(data && data.value === false);
}

export const round2 = (n: number) => Math.round(n * 100) / 100;
export const stockInRef = (ref?: string | null) => (ref ? `STK-IN-${ref}` : null);
export const stockOutRef = (ref?: string | null) => (ref ? `STK-OUT-${ref}` : null);

export async function logXeroError(supabase: Client, operation: string, entity: string | null, message: string, status: number | null = null) {
  try {
    await supabase.from('integration_error_log').insert({
      integration: 'xero', operation, entity_ref: entity, status, message: message.slice(0, 2000),
    });
  } catch (e) {
    console.error('Failed to write integration error log:', (e as Error).message);
  }
}
