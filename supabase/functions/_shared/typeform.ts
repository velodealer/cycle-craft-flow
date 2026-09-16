// Shared Typeform helpers for edge functions.
import { createClient } from 'npm:@supabase/supabase-js@2';

export const TYPEFORM_INTEGRATION_NAME = 'typeform';

export interface TypeformSettings {
  access_token?: string;
  refresh_token?: string;
  access_token_expires_at?: string;
  account_display_name?: string;
  connected_at?: string;
}

export function serviceClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );
}

export function typeformApiBase() {
  return 'https://api.typeform.com';
}

export function functionsBase() {
  return (
    Deno.env.get('PUBLIC_FUNCTIONS_BASE_URL') || `${Deno.env.get('SUPABASE_URL')}/functions/v1`
  ).trim().replace(/\/+$/, '');
}

export function redirectUri() {
  return `${functionsBase()}/typeform-oauth`;
}

export async function loadIntegration(supabase: ReturnType<typeof serviceClient>) {
  const { data, error } = await supabase
    .from('integrations')
    .select('*')
    .eq('name', TYPEFORM_INTEGRATION_NAME)
    .maybeSingle();
  if (error) throw new Error(`Failed to load Typeform integration: ${error.message}`);
  return data;
}

export async function saveSettings(
  supabase: ReturnType<typeof serviceClient>,
  settings: TypeformSettings,
  isActive = true,
) {
  const existing = await loadIntegration(supabase);
  const merged = { ...(existing?.settings as TypeformSettings ?? {}), ...settings };
  if (existing) {
    const { error } = await supabase
      .from('integrations')
      .update({ settings: merged, is_active: isActive, updated_at: new Date().toISOString() })
      .eq('id', existing.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from('integrations').insert({
      name: TYPEFORM_INTEGRATION_NAME,
      display_name: 'Typeform',
      is_active: isActive,
      settings: merged,
    });
    if (error) throw new Error(error.message);
  }
  return merged;
}

async function refreshAccessToken(refreshToken: string) {
  const clientId = Deno.env.get('TYPEFORM_CLIENT_ID');
  const clientSecret = Deno.env.get('TYPEFORM_CLIENT_SECRET');
  if (!clientId || !clientSecret) throw new Error('TYPEFORM_CLIENT_ID / TYPEFORM_CLIENT_SECRET are not configured');
  const basic = btoa(`${clientId}:${clientSecret}`);
  const res = await fetch('https://api.typeform.com/oauth/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`Typeform token refresh failed [${res.status}]: ${body}`);
  return JSON.parse(body) as {
    access_token: string;
    expires_in: number;
    refresh_token: string;
  };
}

/** Returns a valid access token, refreshing and persisting when needed. */
export async function getTypeformAuth(supabase: ReturnType<typeof serviceClient>) {
  const integration = await loadIntegration(supabase);
  const settings = (integration?.settings ?? {}) as TypeformSettings;
  if (!integration?.is_active || (!settings.refresh_token && !settings.access_token)) {
    throw new Error('Typeform is not connected');
  }

  const expiresAt = settings.access_token_expires_at ? Date.parse(settings.access_token_expires_at) : 0;
  if (settings.access_token && expiresAt - Date.now() > 60_000) {
    return { accessToken: settings.access_token, settings };
  }

  if (!settings.refresh_token) {
    throw new Error('Your Typeform session has expired — please reconnect Typeform in Settings.');
  }


  const tokens = await refreshAccessToken(settings.refresh_token);
  const updated = await saveSettings(supabase, {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token || settings.refresh_token,
    access_token_expires_at: new Date(Date.now() + (tokens.expires_in - 60) * 1000).toISOString(),
  });
  return { accessToken: tokens.access_token, settings: updated as TypeformSettings };
}

export async function typeformFetch(accessToken: string, path: string, init: RequestInit = {}) {
  const res = await fetch(`${typeformApiBase()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers as Record<string, string> | undefined),
    },
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`Typeform request failed [${res.status}] ${path}: ${text}`);
    throw new Error(`Typeform request failed [${res.status}]: ${text}`);
  }
  return text ? JSON.parse(text) : null;
}

/** Registers or removes the response webhook for a Typeform form. */
export async function setTypeformWebhook(
  accessToken: string,
  formId: string,
  tag: string,
  enabled: boolean,
) {
  if (enabled) {
    const secret = Deno.env.get('TYPEFORM_WEBHOOK_SECRET');
    if (!secret) throw new Error('TYPEFORM_WEBHOOK_SECRET is not configured');
    await typeformFetch(accessToken, `/forms/${formId}/webhooks/${encodeURIComponent(tag)}`, {
      method: 'PUT',
      body: JSON.stringify({
        enabled: true,
        url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/typeform-webhook`,
        secret,
      }),
    });
  } else {
    await typeformFetch(accessToken, `/forms/${formId}/webhooks/${encodeURIComponent(tag)}`, {
      method: 'DELETE',
    });
  }
}

/** Validates the caller's JWT and returns their user, or throws. */
export async function requireUser(req: Request, supabase: ReturnType<typeof serviceClient>) {
  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) throw new Error('Missing Authorization header');
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) throw new Error('Invalid or expired session');
  return data.user;
}

/** Ensures the caller is an admin or owner (for settings-changing actions). */
export async function requireAdmin(supabase: ReturnType<typeof serviceClient>, userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !data) throw new Error('Could not load your profile');
  if (!['admin', 'owner'].includes((data as { role: string }).role)) {
    throw new Error('Only admins and owners can manage the Typeform integration');
  }
  return data;
}
