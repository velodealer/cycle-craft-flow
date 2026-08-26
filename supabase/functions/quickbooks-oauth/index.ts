import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import {
  serviceClient,
  loadIntegration,
  saveSettings,
  getQboAuth,
  qboFetch,
  redirectUri,
  qboEnv,
  requireUser,
  type QboSettings,
} from '../_shared/quickbooks.ts';
import { mapSalesTaxCodes, type QboTaxCodeRef } from '../_shared/quickbooks-tax.ts';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = serviceClient();
  const url = new URL(req.url);

  // ---- OAuth callback from Intuit (browser redirect, no JWT) ----
  if (req.method === 'GET' && url.searchParams.get('code')) {
    try {
      const code = url.searchParams.get('code')!;
      const realmId = url.searchParams.get('realmId');
      if (!realmId) throw new Error('Missing realmId in callback');

      const clientId = Deno.env.get('QUICKBOOKS_CLIENT_ID')!;
      const clientSecret = Deno.env.get('QUICKBOOKS_CLIENT_SECRET')!;
      const res = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri(),
        }),
      });
      const text = await res.text();
      if (!res.ok) throw new Error(`Token exchange failed [${res.status}]: ${text}`);
      const tokens = JSON.parse(text);

      await saveSettings(supabase, {
        realm_id: realmId,
        refresh_token: tokens.refresh_token,
        access_token: tokens.access_token,
        access_token_expires_at: new Date(Date.now() + (tokens.expires_in - 60) * 1000).toISOString(),
        connected_at: new Date().toISOString(),
      });

      return new Response(
        `<!doctype html><html><body style="font-family:system-ui;padding:2rem">
         <h2>QuickBooks connected</h2><p>You can close this window.</p>
         <script>window.opener&&window.opener.postMessage({type:'quickbooks-connected'},'*');setTimeout(()=>window.close(),1200)</script>
         </body></html>`,
        { headers: { 'Content-Type': 'text/html' } },
      );
    } catch (e) {
      console.error('QuickBooks callback error', e);
      return new Response(
        `<!doctype html><html><body style="font-family:system-ui;padding:2rem">
         <h2>QuickBooks connection failed</h2><pre>${String((e as Error).message)}</pre></body></html>`,
        { status: 500, headers: { 'Content-Type': 'text/html' } },
      );
    }
  }

  // ---- Authenticated JSON API ----
  try {
    await requireUser(req, supabase);
  } catch (e) {
    return json({ error: (e as Error).message }, 401);
  }

  try {
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const action = body.action || url.searchParams.get('action') || 'status';

    if (action === 'status') {
      const integration = await loadIntegration(supabase);
      const settings = (integration?.settings ?? {}) as QboSettings;
      return json({
        connected: Boolean(integration?.is_active && settings.refresh_token && settings.realm_id),
        environment: qboEnv(),
        realm_id: settings.realm_id ?? null,
        accounts: settings.accounts ?? {},
        tax_codes: settings.tax_codes ?? {},
        connected_at: settings.connected_at ?? null,
        redirect_uri: redirectUri(),
      });
    }

    if (action === 'auth_url') {
      const clientId = Deno.env.get('QUICKBOOKS_CLIENT_ID');
      if (!clientId) return json({ error: 'QUICKBOOKS_CLIENT_ID is not configured' }, 400);
      const params = new URLSearchParams({
        client_id: clientId,
        response_type: 'code',
        scope: 'com.intuit.quickbooks.accounting',
        redirect_uri: redirectUri(),
        state: crypto.randomUUID(),
      });
      return json({ url: `https://appcenter.intuit.com/connect/oauth2?${params}` });
    }

    if (action === 'accounts') {
      const { accessToken, realmId } = await getQboAuth(supabase);
      const query = encodeURIComponent(
        "select Id, Name, AccountType, AccountSubType, Classification from Account where Active = true maxresults 1000",
      );
      const data = await qboFetch(accessToken, realmId, `/query?query=${query}&minorversion=70`);
      const accounts = (data?.QueryResponse?.Account ?? []).map((a: any) => ({
        id: a.Id,
        name: a.Name,
        type: a.AccountType,
        subType: a.AccountSubType,
        classification: a.Classification,
      }));
      return json({ accounts });
    }

    if (action === 'tax_codes') {
      const { accessToken, realmId } = await getQboAuth(supabase);
      const taxCodeQuery = encodeURIComponent('select * from TaxCode where Active = true maxresults 1000');
      const taxRateQuery = encodeURIComponent('select * from TaxRate where Active = true maxresults 1000');
      const [taxCodeData, taxRateData] = await Promise.all([
        qboFetch(accessToken, realmId, `/query?query=${taxCodeQuery}&minorversion=70`),
        qboFetch(accessToken, realmId, `/query?query=${taxRateQuery}&minorversion=70`),
      ]);
      return json({
        tax_codes: mapSalesTaxCodes(
          taxCodeData?.QueryResponse?.TaxCode ?? [],
          taxRateData?.QueryResponse?.TaxRate ?? [],
        ),
      });
    }

    if (action === 'save_accounts') {
      const accounts = body.accounts ?? {};
      await saveSettings(supabase, { accounts });
      return json({ ok: true, accounts });
    }

    if (action === 'save_tax_codes') {
      const taxCodes = body.tax_codes as QboTaxCodeRef | undefined;
      if (
        !taxCodes ||
        typeof taxCodes.standard_sales !== 'string' ||
        typeof taxCodes.margin_sales !== 'string' ||
        !taxCodes.standard_sales.trim() ||
        !taxCodes.margin_sales.trim()
      ) {
        return json({ error: 'Select both QuickBooks sales VAT codes' }, 400);
      }
      const saved = {
        standard_sales: taxCodes.standard_sales.trim(),
        margin_sales: taxCodes.margin_sales.trim(),
      };
      await saveSettings(supabase, { tax_codes: saved });
      return json({ ok: true, tax_codes: saved });
    }

    if (action === 'disconnect') {
      const integration = await loadIntegration(supabase);
      if (integration) {
        const settings = (integration.settings ?? {}) as QboSettings;
        delete settings.refresh_token;
        delete settings.access_token;
        delete settings.access_token_expires_at;
        delete settings.realm_id;
        const { error } = await supabase
          .from('integrations')
          .update({ settings, is_active: false, updated_at: new Date().toISOString() })
          .eq('id', integration.id);
        if (error) throw new Error(error.message);
      }
      return json({ ok: true });
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (e) {
    console.error('quickbooks-oauth error', e);
    return json({ error: (e as Error).message }, 500);
  }
});
