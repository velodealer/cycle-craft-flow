// Xero OAuth + settings endpoint (per dealership).
// GET ?code=  → OAuth callback from Xero (browser redirect, no JWT)
// POST { action } → authenticated JSON API
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import {
  serviceClient, requireUser, profileFor, loadIntegration, saveSettings, tokenRequest, getXeroAuth,
  xeroFetch, xeroCredentials, redirectUri, XERO_SCOPES, type XeroSettings, type XeroAccounts, type XeroTaxTypes,
} from '../_shared/xero.ts';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const FALLBACK_APP_ORIGIN = 'https://velodealer.com';
const backToApp = (origin: string, params: Record<string, string>) => {
  const qs = new URLSearchParams({ tab: 'integrations', ...params });
  return new Response(null, { status: 302, headers: { Location: `${origin}/settings?${qs}` } });
};

const ACCOUNT_KEYS: (keyof XeroAccounts)[] = ['stock', 'cogs', 'sales', 'vat', 'purchase_funding'];
const code = (v: unknown) => (typeof v === 'string' && /^[A-Za-z0-9._-]{1,20}$/.test(v.trim()) ? v.trim() : undefined);

async function listTenants(accessToken: string) {
  const res = await fetch('https://api.xero.com/connections', { headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' } });
  const text = await res.text();
  if (!res.ok) throw new Error(`Could not list Xero organisations [${res.status}]: ${text}`);
  return (JSON.parse(text) as any[])
    .filter((c) => c.tenantType === 'ORGANISATION')
    .map((c) => ({ id: c.tenantId as string, name: c.tenantName as string, connection_id: c.id as string }));
}

/** Re-checks mapped accounts / VAT rates still exist and are active in Xero. */
async function checkHealth(supabase: ReturnType<typeof serviceClient>, businessId: string) {
  const auth = await getXeroAuth(supabase, businessId);
  const s = auth.settings;
  const [acc, tax] = await Promise.all([xeroFetch(auth, '/Accounts'), xeroFetch(auth, '/TaxRates')]);
  const activeCodes = new Set((acc?.Accounts ?? []).filter((a: any) => a.Status === 'ACTIVE').map((a: any) => a.Code));
  const activeTax = new Set((tax?.TaxRates ?? []).filter((t: any) => t.Status === 'ACTIVE').map((t: any) => t.TaxType));
  activeTax.add('NONE');
  const health = {
    missing_accounts: Object.entries(s.accounts ?? {}).filter(([, v]) => v && !activeCodes.has(v)).map(([k]) => k),
    missing_tax_types: Object.entries(s.tax_types ?? {}).filter(([, v]) => v && !activeTax.has(v)).map(([k]) => k),
    checked_at: new Date().toISOString(),
  };
  await saveSettings(supabase, businessId, { health });
  return health;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const supabase = serviceClient();
  const url = new URL(req.url);

  // ---- OAuth callback ----
  if (req.method === 'GET' && (url.searchParams.get('code') || url.searchParams.get('error'))) {
    const state = url.searchParams.get('state') ?? '';
    let origin = FALLBACK_APP_ORIGIN;
    try {
      const { data: row } = await supabase.from('xero_oauth_states').select('*').eq('state', state).maybeSingle();
      if (!row) throw new Error('This Xero connection link has expired — please try connecting again.');
      await supabase.from('xero_oauth_states').delete().eq('state', state);
      const rec = row as { business_id: string; origin: string | null; created_at: string };
      if (rec.origin) origin = rec.origin;
      if (Date.now() - Date.parse(rec.created_at) > 15 * 60_000) throw new Error('This Xero connection link has expired — please try connecting again.');
      const err = url.searchParams.get('error');
      if (err) throw new Error(url.searchParams.get('error_description') || err);

      const t = await tokenRequest({ grant_type: 'authorization_code', code: url.searchParams.get('code')!, redirect_uri: redirectUri() });
      const tenants = await listTenants(t.access_token);
      const existing = (await loadIntegration(supabase, rec.business_id))?.settings ?? {};
      const keep = tenants.find((x) => x.id === existing.tenant_id);
      const chosen = keep ?? (tenants.length === 1 ? tenants[0] : undefined);
      await saveSettings(supabase, rec.business_id, {
        refresh_token: t.refresh_token,
        access_token: t.access_token,
        access_token_expires_at: new Date(Date.now() + t.expires_in * 1000).toISOString(),
        connected_at: new Date().toISOString(),
        tenant_id: chosen?.id,
        tenant_name: chosen?.name,
        auth_error: undefined,
      });
      return backToApp(origin, { xero: chosen ? 'connected' : 'choose_org' });
    } catch (e) {
      console.error('Xero callback error', e);
      return backToApp(origin, { xero: 'error', message: String((e as Error).message).slice(0, 300) });
    }
  }

  // ---- Authenticated API ----
  let profile: { id: string; role: string; business_id: string };
  let userId: string;
  try {
    const user = await requireUser(req, supabase);
    userId = user.id;
    profile = await profileFor(supabase, user.id);
  } catch (e) {
    return json({ error: (e as Error).message }, 401);
  }
  const businessId = profile.business_id;
  const manager = profile.role === 'admin' || profile.role === 'owner';
  if (!manager && profile.role !== 'accountant') return json({ error: 'You do not have permission to do that' }, 403);

  try {
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const action = String(body.action || 'status');
    if (!manager && action !== 'status') return json({ error: 'You do not have permission to do that' }, 403);

    if (action === 'status') {
      const row = await loadIntegration(supabase, businessId);
      const s: XeroSettings = row?.settings ?? {};
      let configured = true;
      try { xeroCredentials(); } catch { configured = false; }
      return json({
        configured,
        connected: Boolean(row?.is_active && s.refresh_token),
        tenant_id: s.tenant_id ?? null,
        tenant_name: s.tenant_name ?? null,
        connected_at: s.connected_at ?? null,
        accounts: s.accounts ?? {},
        tax_types: s.tax_types ?? {},
        auth_error: s.auth_error ?? null,
        health: s.health ?? null,
        redirect_uri: redirectUri(),
        can_manage: manager,
      });
    }

    if (action === 'auth_url') {
      const { id } = xeroCredentials();
      const origin = typeof body.origin === 'string' && /^https?:\/\//.test(body.origin) ? body.origin.replace(/\/+$/, '') : FALLBACK_APP_ORIGIN;
      const state = crypto.randomUUID();
      await supabase.from('xero_oauth_states').delete().eq('business_id', businessId);
      const { error } = await supabase.from('xero_oauth_states').insert({ state, business_id: businessId, user_id: userId, origin });
      if (error) throw new Error(error.message);
      return json({ url: 'https://login.xero.com/identity/connect/authorize?' + new URLSearchParams({
        response_type: 'code', client_id: id, redirect_uri: redirectUri(), scope: XERO_SCOPES, state,
      }) });
    }

    if (action === 'tenants') {
      const row = await loadIntegration(supabase, businessId);
      if (!row?.settings?.refresh_token) throw new Error('Xero is not connected');
      // Refresh without requiring a tenant to be chosen yet.
      const t = await tokenRequest({ grant_type: 'refresh_token', refresh_token: row.settings.refresh_token });
      await saveSettings(supabase, businessId, {
        refresh_token: t.refresh_token, access_token: t.access_token,
        access_token_expires_at: new Date(Date.now() + t.expires_in * 1000).toISOString(),
      });
      return json({ tenants: await listTenants(t.access_token) });
    }

    if (action === 'choose_tenant') {
      const id = typeof body.tenant_id === 'string' ? body.tenant_id : '';
      const row = await loadIntegration(supabase, businessId);
      if (!row?.settings?.access_token) throw new Error('Xero is not connected');
      const auth = await (async () => {
        const t = await tokenRequest({ grant_type: 'refresh_token', refresh_token: row.settings.refresh_token! });
        await saveSettings(supabase, businessId, {
          refresh_token: t.refresh_token, access_token: t.access_token,
          access_token_expires_at: new Date(Date.now() + t.expires_in * 1000).toISOString(),
        });
        return t.access_token;
      })();
      const match = (await listTenants(auth)).find((x) => x.id === id);
      if (!match) return json({ error: 'That organisation is not available on this Xero sign-in.' }, 400);
      const switching = row.settings.tenant_id && row.settings.tenant_id !== id;
      await saveSettings(supabase, businessId, {
        tenant_id: match.id, tenant_name: match.name,
        ...(switching ? { accounts: {}, tax_types: {}, health: undefined } : {}),
      });
      return json({ ok: true });
    }

    if (action === 'accounts') {
      const auth = await getXeroAuth(supabase, businessId);
      const data = await xeroFetch(auth, '/Accounts');
      return json({ accounts: (data?.Accounts ?? [])
        .filter((a: any) => a.Status === 'ACTIVE' && a.Code)
        .map((a: any) => ({ code: a.Code, name: a.Name, type: a.Type, class: a.Class, system: a.SystemAccount ?? null })) });
    }

    if (action === 'tax_rates') {
      const auth = await getXeroAuth(supabase, businessId);
      const data = await xeroFetch(auth, '/TaxRates');
      return json({ tax_rates: (data?.TaxRates ?? [])
        .filter((t: any) => t.Status === 'ACTIVE' && t.CanApplyToRevenue !== false)
        .map((t: any) => ({ type: t.TaxType, name: t.Name, rate: t.EffectiveRate ?? null })) });
    }

    if (action === 'save_accounts') {
      const accounts: XeroAccounts = {};
      for (const k of ACCOUNT_KEYS) { const v = code(body.accounts?.[k]); if (v) accounts[k] = v; }
      await saveSettings(supabase, businessId, { accounts });
      return json({ ok: true, health: await checkHealth(supabase, businessId).catch(() => null) });
    }

    if (action === 'save_tax_rates') {
      const tax_types: XeroTaxTypes = {};
      const s = code(body.tax_types?.standard_sales); if (s) tax_types.standard_sales = s;
      const m = code(body.tax_types?.margin_sales); if (m) tax_types.margin_sales = m;
      await saveSettings(supabase, businessId, { tax_types });
      return json({ ok: true, health: await checkHealth(supabase, businessId).catch(() => null) });
    }

    if (action === 'health') return json({ health: await checkHealth(supabase, businessId) });

    if (action === 'disconnect') {
      const row = await loadIntegration(supabase, businessId);
      if (row?.settings?.refresh_token) {
        await fetch('https://identity.xero.com/connect/revocation', {
          method: 'POST',
          headers: { Authorization: `Basic ${xeroCredentials().basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ token: row.settings.refresh_token }),
        }).then((r) => r.text()).catch((e) => console.warn('Xero revoke failed', e));
      }
      if (row) {
        // Keep the account/VAT mapping so reconnecting the same organisation needs no re-setup.
        const { accounts, tax_types, tenant_id, tenant_name } = row.settings ?? {};
        const { error } = await supabase.from('integrations')
          .update({ settings: { accounts, tax_types, tenant_id, tenant_name }, is_active: false, updated_at: new Date().toISOString() })
          .eq('id', row.id);
        if (error) throw new Error(error.message);
      }
      console.log(`Xero disconnected by ${userId}`);
      return json({ ok: true });
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (e) {
    console.error('xero-oauth error:', (e as Error).message);
    return json({ error: (e as Error).message }, 400);
  }
});
