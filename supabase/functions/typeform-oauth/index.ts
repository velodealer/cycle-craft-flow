// Typeform OAuth + configuration endpoint.
// GET  with ?code=...  → OAuth callback from Typeform (browser redirect, no JWT)
// POST { action }      → authenticated JSON API
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { sendNotification, loadEmailSettings, appUrl } from '../_shared/email.ts';
import { submissionEmail } from '../_shared/email-templates.ts';
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
import { extractFromFormResponse } from '../_shared/typeform-extract.ts';
import { rehostTypeformFiles } from '../_shared/typeform-files.ts';

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
      const expiresAt = settings.access_token_expires_at ? Date.parse(settings.access_token_expires_at) : 0;
      const accessValid = Boolean(settings.access_token && expiresAt > Date.now());
      return json({
        connected: Boolean(integration?.is_active && (settings.refresh_token || accessValid)),
        needs_reconnect: Boolean(integration?.is_active && !settings.refresh_token),
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
        scope: 'forms:read responses:read webhooks:read webhooks:write offline',
        redirect_uri: redirectUri(),
        state: encodeURIComponent(String(body.app_origin ?? '') || FALLBACK_APP_ORIGIN),
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

      // If Typeform refuses, do NOT record the form as enabled — the error surfaces to the UI.
      try {
        await setTypeformWebhook(accessToken, formId, tag, enabled);
      } catch (err) {
        console.error(`Failed to ${enabled ? 'register' : 'remove'} Typeform webhook for ${formId}`, err);
        return json({
          error: `Typeform would not ${enabled ? 'set up' : 'remove'} the response notification: ${(err as Error).message}`,
        }, 400);
      }

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

    // Live state of the response notification registered at Typeform.
    if (action === 'webhook_status') {
      const formId = String(body.form_id ?? '').trim();
      if (!formId) return json({ error: 'form_id is required' }, 400);

      const { data: stored } = await supabase
        .from('typeform_forms')
        .select('webhook_tag')
        .eq('form_id', formId)
        .maybeSingle();
      const tag = (stored as any)?.webhook_tag || 'velodealer';
      const expectedUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/typeform-webhook`;

      const { accessToken } = await getTypeformAuth(supabase);
      try {
        const hook = await typeformFetch(accessToken, `/forms/${formId}/webhooks/${encodeURIComponent(tag)}`);
        return json({
          registered: true,
          enabled: Boolean(hook?.enabled),
          url: hook?.url ?? null,
          url_matches: hook?.url === expectedUrl,
          verify_ssl: hook?.verify_ssl ?? null,
          expected_url: expectedUrl,
        });
      } catch (err) {
        const message = (err as Error).message;
        if (message.includes('[404]')) {
          return json({ registered: false, enabled: false, expected_url: expectedUrl });
        }
        return json({ error: message }, 400);
      }
    }

    // Re-create the notification at Typeform (repairs a lost or stale registration).
    if (action === 'reregister_webhook') {
      const formId = String(body.form_id ?? '').trim();
      if (!formId) return json({ error: 'form_id is required' }, 400);

      const { data: stored } = await supabase
        .from('typeform_forms')
        .select('id, webhook_tag')
        .eq('form_id', formId)
        .maybeSingle();
      const tag = (stored as any)?.webhook_tag || 'velodealer';

      const { accessToken } = await getTypeformAuth(supabase);
      await setTypeformWebhook(accessToken, formId, tag, true);

      if (stored) {
        await supabase
          .from('typeform_forms')
          .update({ enabled: true, updated_at: new Date().toISOString() })
          .eq('id', (stored as any).id);
      } else {
        await supabase.from('typeform_forms').insert({
          form_id: formId,
          title: String(body.title ?? '').trim() || formId,
          enabled: true,
          webhook_tag: tag,
        });
      }
      return json({ ok: true });
    }

    // Pulls recent responses straight from Typeform and files any we are missing.
    if (action === 'fetch_responses') {
      const formId = String(body.form_id ?? '').trim();
      if (!formId) return json({ error: 'form_id is required' }, 400);

      const { data: stored } = await supabase
        .from('typeform_forms')
        .select('field_map')
        .eq('form_id', formId)
        .maybeSingle();
      const fieldMap = ((stored as any)?.field_map ?? {}) as Record<string, string>;

      const { accessToken } = await getTypeformAuth(supabase);
      let data: any;
      try {
        data = await typeformFetch(accessToken, `/forms/${formId}/responses?page_size=25`);
      } catch (err) {
        const message = (err as Error).message;
        if (message.includes('[403]') || message.includes('INSUFFICIENT_PERMISSIONS')) {
          return json({
            error:
              'Typeform has not granted permission to read responses. Press Disconnect, then Connect Typeform again and approve — the new approval screen includes reading responses.',
          }, 403);
        }
        throw err;
      }
      const items: any[] = data?.items ?? [];

      let imported = 0;
      let skipped = 0;
      for (const item of items) {
        const responseId = item?.response_id || item?.token;
        if (!responseId) continue;

        const { data: existing } = await supabase
          .from('typeform_submissions')
          .select('id')
          .eq('response_id', responseId)
          .maybeSingle();
        if (existing) { skipped++; continue; }

        const formResponse = { ...item, form_id: formId };
        const extracted = extractFromFormResponse(formResponse, fieldMap);
        try {
          extracted.photo_urls = await rehostTypeformFiles(
            supabase,
            accessToken,
            responseId,
            extracted.photo_urls,
          );
        } catch (err) {
          console.error('fetch_responses: photo copy failed', err);
        }
        const { error } = await supabase.from('typeform_submissions').insert({
          form_id: formId,
          response_id: responseId,
          submitted_at: item?.submitted_at ?? new Date().toISOString(),
          raw_payload: { event_type: 'fetched', form_response: formResponse },
          ...extracted,
          status: 'new',
        });
        if (error) throw new Error(error.message);
        imported++;
        try {
          const settings = await loadEmailSettings(supabase);
          const mail = submissionEmail(extracted, appUrl(settings));
          await sendNotification(supabase, 'submission_received', mail.subject, mail.html);
        } catch (err) {
          console.error('fetch_responses: notification email failed', err);
        }
      }

      return json({ ok: true, imported, skipped, total: items.length });
    }

    if (action === 'rehost_photos') {
      const { accessToken } = await getTypeformAuth(supabase);
      const { data: rows, error: loadError } = await supabase
        .from('typeform_submissions')
        .select('id, response_id, photo_urls')
        .limit(500);
      if (loadError) throw new Error(loadError.message);

      let fixed = 0;
      let failed = 0;
      for (const row of rows ?? []) {
        const urls = ((row as any).photo_urls ?? []) as string[];
        if (!urls.some((u) => u?.includes('api.typeform.com'))) continue;
        try {
          const rehosted = await rehostTypeformFiles(
            supabase,
            accessToken,
            (row as any).response_id,
            urls,
          );
          if (rehosted.some((u) => u.includes('api.typeform.com'))) failed++;
          const { error } = await supabase
            .from('typeform_submissions')
            .update({ photo_urls: rehosted })
            .eq('id', (row as any).id);
          if (error) throw new Error(error.message);
          fixed++;
        } catch (err) {
          console.error('rehost_photos failed for submission', (row as any).id, err);
          failed++;
        }
      }

      return json({ ok: true, fixed, failed });
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
