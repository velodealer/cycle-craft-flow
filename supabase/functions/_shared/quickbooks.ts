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
}


/**
 * What the connected QuickBooks company can actually do right now.
 * Customers change QuickBooks Online subscriptions at any time, so we read this
 * from the company itself instead of assuming a product level.
 */
export interface QboCapabilities {
  sales_tax: boolean;
  tax_codes: string[];
  journal_entries: boolean;
  multicurrency: boolean;
  accounts_present: string[];
  accounts_missing: string[];
  country?: string;
  home_currency?: string;
}

export interface QboSettings {
  realm_id?: string;
  refresh_token?: string;
  access_token?: string;
  access_token_expires_at?: string;
  accounts?: QboAccounts;
  tax_codes?: QboTaxCodeRef;
  connected_at?: string;
  oauth_state?: string;
  auth_error?: string;
  capabilities?: QboCapabilities;
  capabilities_checked_at?: string;
  capabilities_error?: string;
}

/** Thrown when Intuit rejects the refresh token (expired/revoked) — user must reconnect. */
export class QboReconnectRequired extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QboReconnectRequired';
  }
}

/** Thrown when the company's current QuickBooks version cannot do what we need. */
export class QboFeatureUnavailable extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QboFeatureUnavailable';
  }
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

export function functionsBase() {
  return (
    Deno.env.get('PUBLIC_FUNCTIONS_BASE_URL') || `${Deno.env.get('SUPABASE_URL')}/functions/v1`
  ).trim().replace(/\/+$/, '');
}

export function redirectUri() {
  return `${functionsBase()}/quickbooks-oauth`;
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

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function refreshAccessTokenOnce(refreshToken: string) {
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
  if (!res.ok) {
    if (body.includes('invalid_grant')) {
      throw new QboReconnectRequired(`QuickBooks refresh token expired or was revoked: ${body}`);
    }
    throw new Error(`QuickBooks token refresh failed [${res.status}]: ${body}`);
  }
  return JSON.parse(body) as {
    access_token: string;
    expires_in: number;
    refresh_token: string;
  };
}

/** Refresh with a single retry on transient failures (network errors, 5xx). */
async function refreshAccessToken(refreshToken: string) {
  try {
    return await refreshAccessTokenOnce(refreshToken);
  } catch (e) {
    if (e instanceof QboReconnectRequired) throw e;
    await sleep(1500);
    return await refreshAccessTokenOnce(refreshToken);
  }
}

/** Mark the integration as needing reconnection so the UI can prompt the user. */
export async function markReconnectRequired(
  supabase: ReturnType<typeof serviceClient>,
  message: string,
) {
  await saveSettings(supabase, { auth_error: message }, false);
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

  try {
    const tokens = await refreshAccessToken(settings.refresh_token);
    const updated = await saveSettings(supabase, {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || settings.refresh_token,
      access_token_expires_at: new Date(Date.now() + (tokens.expires_in - 60) * 1000).toISOString(),
      auth_error: undefined,
    });
    return { accessToken: tokens.access_token, realmId: settings.realm_id, settings: updated as QboSettings };
  } catch (e) {
    if (e instanceof QboReconnectRequired) {
      await markReconnectRequired(supabase, e.message);
    }
    throw e;
  }
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
  const tid = res.headers.get('intuit_tid') || res.headers.get('intuit-tid');
  if (!res.ok) {
    console.error(`QuickBooks request failed [${res.status}] ${path}: ${text} intuit_tid: ${tid ?? 'n/a'}`);
    const err = new Error(`QuickBooks request failed [${res.status}]: ${text} (intuit_tid: ${tid ?? 'n/a'})`);
    const tagged = err as Error & { status?: number; intuitTid?: string | null };
    tagged.status = res.status;
    tagged.intuitTid = tid;
    throw tagged;
  }
  if (tid) console.log(`QuickBooks ${init.method ?? 'GET'} ${path} -> ${res.status} intuit_tid: ${tid}`);
  return text ? JSON.parse(text) : null;
}

export interface IntegrationErrorEntry {
  integration: string;
  operation: string;
  entity_ref?: string | null;
  status?: number | null;
  intuit_tid?: string | null;
  message: string;
  detail?: Record<string, unknown> | null;
}

/**
 * Fire-and-forget write to the central integration error log.
 * Never throws — logging must not break the caller.
 */
export async function logIntegrationError(
  supabase: ReturnType<typeof serviceClient>,
  entry: IntegrationErrorEntry,
) {
  try {
    await supabase.from('integration_error_log').insert({
      integration: entry.integration,
      operation: entry.operation,
      entity_ref: entry.entity_ref ?? null,
      status: entry.status ?? null,
      intuit_tid: entry.intuit_tid ?? null,
      message: entry.message.slice(0, 2000),
      detail: entry.detail ?? null,
    });
  } catch (e) {
    console.error('Failed to write integration error log:', (e as Error).message);
  }
}

/** Pull status and intuit_tid off an error thrown by qboFetch, if present. */
export function qboErrorInfo(e: unknown): { status: number | null; intuitTid: string | null } {
  const tagged = e as Error & { status?: number; intuitTid?: string | null };
  return { status: tagged?.status ?? null, intuitTid: tagged?.intuitTid ?? null };
}

/**
 * Authenticated QuickBooks API call with self-healing:
 * gets a valid token, and on a 401 forces one token refresh and retries once.
 */
export async function qboFetchAuthed(
  supabase: ReturnType<typeof serviceClient>,
  path: string,
  init: RequestInit = {},
) {
  const auth = await getQboAuth(supabase);
  try {
    return await qboFetch(auth.accessToken, auth.realmId, path, init);
  } catch (e) {
    if ((e as Error & { status?: number }).status !== 401) throw e;
    // Force a refresh by clearing the cached access token, then retry once.
    await saveSettings(supabase, { access_token: undefined, access_token_expires_at: undefined });
    const fresh = await getQboAuth(supabase);
    return await qboFetch(fresh.accessToken, fresh.realmId, path, init);
  }
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

/** How long a stored capability profile is trusted before we re-read it. */
const CAPABILITIES_TTL_MS = 24 * 60 * 60 * 1000;

const ACCOUNT_LABELS: Record<string, string> = {
  stock: 'Stock / inventory asset account',
  cogs: 'Cost of goods sold account',
  sales: 'Sales income account',
  vat: 'VAT control account',
  purchase_funding: 'Purchase funding account',
};

/**
 * Reads the company's preferences and chart of accounts so the integration
 * follows what this QuickBooks company can do today, not what it could do when
 * it was first connected.
 */
export async function fetchCapabilities(
  accessToken: string,
  realmId: string,
  accounts: QboAccounts = {},
): Promise<QboCapabilities> {
  const prefs = await qboFetch(accessToken, realmId, '/preferences?minorversion=70').catch((e) => {
    console.error('Could not read QuickBooks preferences:', (e as Error).message);
    return null;
  });
  const p = prefs?.Preferences ?? {};
  const salesTax = Boolean(p?.TaxPrefs?.UsingSalesTax);
  const multicurrency = Boolean(p?.CurrencyPrefs?.MultiCurrencyEnabled);
  const homeCurrency = p?.CurrencyPrefs?.HomeCurrency?.value;

  const taxQuery = encodeURIComponent('select Id, Name from TaxCode maxresults 100');
  const taxRes = await qboFetch(
    accessToken,
    realmId,
    `/query?query=${taxQuery}&minorversion=70`,
  ).catch(() => null);
  const taxCodes: string[] = (taxRes?.QueryResponse?.TaxCode ?? [])
    .map((t: { Name?: string }) => t?.Name)
    .filter(Boolean);

  const info = await qboFetch(accessToken, realmId, `/companyinfo/${realmId}?minorversion=70`).catch(() => null);
  const country = info?.CompanyInfo?.Country;

  // Confirm the accounts we post to still exist in this company.
  const present: string[] = [];
  const missing: string[] = [];
  for (const [key, id] of Object.entries(accounts)) {
    if (!id) continue;
    const found = await qboFetch(accessToken, realmId, `/account/${id}?minorversion=70`).catch(() => null);
    const active = found?.Account && found.Account.Active !== false;
    (active ? present : missing).push(key);
  }

  // Journal entries are the one posting type we cannot work without; probe read
  // access rather than assuming it from the subscription level.
  const jeQuery = encodeURIComponent('select Id from JournalEntry maxresults 1');
  const jeRes = await qboFetch(accessToken, realmId, `/query?query=${jeQuery}&minorversion=70`)
    .then(() => true)
    .catch(() => false);

  return {
    sales_tax: salesTax,
    tax_codes: taxCodes,
    journal_entries: jeRes,
    multicurrency,
    accounts_present: present,
    accounts_missing: missing,
    country,
    home_currency: homeCurrency,
  };
}

/** Re-reads and stores the capability profile. */
export async function refreshCapabilities(supabase: ReturnType<typeof serviceClient>) {
  const { accessToken, realmId, settings } = await getQboAuth(supabase);
  try {
    const capabilities = await fetchCapabilities(accessToken, realmId, settings.accounts ?? {});
    await saveSettings(supabase, {
      capabilities,
      capabilities_checked_at: new Date().toISOString(),
      capabilities_error: undefined,
    });
    return capabilities;
  } catch (e) {
    const message = (e as Error).message;
    await saveSettings(supabase, { capabilities_error: message });
    throw e;
  }
}

/** Returns the capability profile, refreshing it when missing or older than a day. */
export async function ensureCapabilities(
  supabase: ReturnType<typeof serviceClient>,
  settings: QboSettings,
  force = false,
): Promise<QboCapabilities | null> {
  const checked = settings.capabilities_checked_at ? Date.parse(settings.capabilities_checked_at) : 0;
  const fresh = settings.capabilities && Date.now() - checked < CAPABILITIES_TTL_MS;
  if (fresh && !force) return settings.capabilities ?? null;
  try {
    return await refreshCapabilities(supabase);
  } catch (e) {
    console.error('Capability refresh failed:', (e as Error).message);
    return settings.capabilities ?? null;
  }
}

/** Throws a friendly QboFeatureUnavailable when the company cannot do something we need. */
export function requireCapability(
  capabilities: QboCapabilities | null,
  needs: { journalEntries?: boolean; accounts?: string[] },
) {
  if (!capabilities) return;
  if (needs.journalEntries && capabilities.journal_entries === false) {
    throw new QboFeatureUnavailable(
      'This QuickBooks company cannot accept journal entries on its current plan, so the stock and VAT postings are on hold. Upgrade the QuickBooks subscription or ask an admin to grant journal entry access, then retry the sync.',
    );
  }
  for (const key of needs.accounts ?? []) {
    if (capabilities.accounts_missing.includes(key)) {
      throw new QboFeatureUnavailable(
        `The ${ACCOUNT_LABELS[key] ?? key} mapped in VeloDealer no longer exists in QuickBooks, so this posting is on hold. Re-map it in Settings → Integrations → QuickBooks and retry.`,
      );
    }
  }
}

/** True when a QuickBooks fault is about a feature or account the company no longer has. */
export function isFeatureFault(message: string) {
  const m = message.toLowerCase();
  return (
    m.includes('feature') ||
    m.includes('not supported') ||
    m.includes('unsupported') ||
    m.includes('invalid account') ||
    m.includes('account period closed') ||
    m.includes('invalid reference id') ||
    m.includes('taxcode') ||
    m.includes('tax code') ||
    m.includes('subscription')
  );
}
