// Typeform OAuth + configuration endpoint.
// GET  with ?code=...  → OAuth callback from Typeform (browser redirect, no JWT)
// POST { action }      → authenticated JSON API
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import {
  serviceClient,
  loadIntegration,
  saveSettings,
  getTypeformAuth,
  typeformFetch,
  redirectUri,
  requireUser,
  requireAdmin,
  setTypeformWebhook,
  type TypeformSettings,
} from '../_shared/typeform.ts';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const FALLBACK_APP_ORIGIN = 'https://id-preview--ccc5c487-99e6-4e3f-8a56-0755e4113f30.lovable.app';

/** Only allow http(s) origins we received from the app itself. */
function safeOrigin(state: string | null): string {
  if (!state) return FALLBACK_APP_ORIGIN;
  try {
    const u = new URL(decodeURIComponent(state));
    if (u.protocol === 'http:' || u.protocol === 'https:') return u.origin;
  } catch { /* ignore */ }
  return FALLBACK_APP_ORIGIN;
}

const backToApp = (origin: string, params: Record<string, string>) => {
  const qs = new URLSearchParams({ tab: 'integrations', ...params });
  return new Response(null, {
    status: 302,
    headers: { Location: `${origin}/settings?${qs}` },
  });
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = serviceClient();
  const url = new URL(req.url);

  // ---- OAuth callback from Typeform (browser redirect, no JWT) ----
  if (req.method === 'GET' && url.searchParams.get('code')) {
    try {
      const code = url.searchParams.get('code')!;
      const clientId = Deno.env.get('TYPEFORM_CLIENT_ID');
      const clientSecret = Deno.env.get('TYPEFORM_CLIENT_SECRET');
      if (!clientId || !clientSecret) throw new Error('TYPEFORM_CLIENT_ID / TYPEFORM_CLIENT_SECRET are not configured');

      const res = await fetch('https://api.typeform.com/oauth/token', {
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

      // Fetch the account display name for a friendlier UI.
      let accountName = 'Typeform';
      try {
        const me = await fetch('https://api.typeform.com/me', {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
        });
        if (me.ok) {
          const meData = await me.json();
          accountName = meData.alias || meData.email || accountName;
        }
      } catch {
        // Non-fatal
      }

      await saveSettings(supabase, {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        access_token_expires_at: new Date(Date.now() + (tokens.expires_in - 60) * 1000).toISOString(),
        account_display_name: accountName,
        connected_at: new Date().toISOString(),
      });

      return backToApp(safeOrigin(url.searchParams.get('state')), { typeform: 'connected' });
    } catch (e) {
      console.error('Typeform callback error', e);
      return backToApp(safeOrigin(url.searchParams.get('state')), {
        typeform: 'error',
        message: String((e as Error).message).slice(0, 300),
      });
    }
  }

  // ---- Authenticated JSON API ----
  try {
    const user = await requireUser(req, supabase);
    await requireAdmin(supabase, user.id);
  } catch (e) {
    return json({ error: (e as Error).message }, 401);
  }

  try {
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const action = body.action || url.searchParams.get('action') || 'status';

    if (action === 'status') {
      const integration = await loadIntegration(supabase);
      const settings = (integration?.settings ?? {}) as TypeformSettings;
      return json({
        connected: Boolean(integration?.is_active && settings.refresh_token),
        account_name: settings.account_display_name ?? null,
        connected_at: settings.connected_at ?? null,
        redirect_uri: redirectUri(),
      });
    }

    if (action === 'auth_url') {
      const clientId = Deno.env.get('TYPEFORM_CLIENT_ID');
      if (!clientId) return json({ error: 'TYPEFORM_CLIENT_ID is not configured' }, 400);
      const params = new URLSearchParams({
        client_id: clientId,
        response_type: 'code',
        scope: 'forms:read webhooks:read webhooks:write',
        redirect_uri: redirectUri(),
        state: crypto.randomUUID(),
      });
      return json({ url: `https://api.typeform.com/oauth/authorize?${params}` });
    }

    if (action === 'forms') {
      const { accessToken } = await getTypeformAuth(supabase);
      const data = await typeformFetch(accessToken, '/forms?page_size=200');
      const forms = (data?.items ?? []).map((f: any) => ({
        id: f.id,
        title: f.title,
      }));

      // Merge with stored enabled state and field maps.
      const { data: stored } = await supabase.from('typeform_forms').select('*');
      const storedById = new Map((stored ?? []).map((s: any) => [s.form_id, s]));
      return json({
        forms: forms.map((f: any) => ({
          ...f,
          enabled: storedById.get(f.id)?.enabled ?? false,
          field_map: storedById.get(f.id)?.field_map ?? {},
        })),
      });
    }

    if (action === 'form_fields') {
      const formId = String(body.form_id ?? '').trim();
      if (!formId) return json({ error: 'form_id is required' }, 400);
      const { accessToken } = await getTypeformAuth(supabase);
      const data = await typeformFetch(accessToken, `/forms/${formId}`);
      const fields = (data?.fields ?? []).map((f: any) => ({
        ref: f.ref || f.id,
        title: f.title,
        type: f.type,
      }));
      return json({ fields });
    }

    if (action === 'set_form_enabled') {
      const formId = String(body.form_id ?? '').trim();
      const title = String(body.title ?? '').trim() || formId;
      const enabled = Boolean(body.enabled);
      if (!formId) return json({ error: 'form_id is required' }, 400);

      const { accessToken } = await getTypeformAuth(supabase);

      const { data: existing } = await supabase
        .from('typeform_forms')
        .select('*')
        .eq('form_id', formId)
        .maybeSingle();
      const tag = (existing as any)?.webhook_tag || 'velodealer';

      await setTypeformWebhook(accessToken, formId, tag, enabled);

      if (existing) {
        const { error } = await supabase
          .from('typeform_forms')
          .update({ enabled, title, updated_at: new Date().toISOString() })
          .eq('id', (existing as any).id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase.from('typeform_forms').insert({
          form_id: formId,
          title,
          enabled,
          webhook_tag: tag,
        });
        if (error) throw new Error(error.message);
      }
      return json({ ok: true, enabled });
    }

    if (action === 'save_field_map') {
      const formId = String(body.form_id ?? '').trim();
      const fieldMap = body.field_map ?? {};
      if (!formId) return json({ error: 'form_id is required' }, 400);
      if (typeof fieldMap !== 'object' || Array.isArray(fieldMap)) {
        return json({ error: 'field_map must be an object' }, 400);
      }

      const { data: existing } = await supabase
        .from('typeform_forms')
        .select('id')
        .eq('form_id', formId)
        .maybeSingle();
      if (existing) {
        const { error } = await supabase
          .from('typeform_forms')
          .update({ field_map: fieldMap, updated_at: new Date().toISOString() })
          .eq('id', (existing as any).id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase.from('typeform_forms').insert({
          form_id: formId,
          title: String(body.title ?? '').trim() || formId,
          field_map: fieldMap,
        });
        if (error) throw new Error(error.message);
      }
      return json({ ok: true, field_map: fieldMap });
    }

    if (action === 'disconnect') {
      const integration = await loadIntegration(supabase);
      if (integration) {
        // Best-effort: remove any registered webhooks so Typeform stops calling us.
        try {
          const { accessToken } = await getTypeformAuth(supabase);
          const { data: stored } = await supabase
            .from('typeform_forms')
            .select('form_id, webhook_tag, enabled')
            .eq('enabled', true);
          for (const row of stored ?? []) {
            try {
              await setTypeformWebhook(accessToken, (row as any).form_id, (row as any).webhook_tag, false);
            } catch (err) {
              console.error(`Failed to remove webhook for form ${(row as any).form_id}`, err);
            }
            await supabase
              .from('typeform_forms')
              .update({ enabled: false })
              .eq('form_id', (row as any).form_id);
          }
        } catch (err) {
          console.error('Failed to clean up Typeform webhooks on disconnect', err);
        }

        const settings = (integration.settings ?? {}) as TypeformSettings;
        delete settings.refresh_token;
        delete settings.access_token;
        delete settings.access_token_expires_at;
        delete settings.account_display_name;
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
    console.error('typeform-oauth error', e);
    return json({ error: (e as Error).message }, 500);
  }
});
