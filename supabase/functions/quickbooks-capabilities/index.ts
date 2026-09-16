// Reads what the connected QuickBooks Online company can do today.
// Customers change QuickBooks subscriptions at any time, so the integration is
// driven by this profile rather than by assumptions about their product level.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import {
  serviceClient,
  requireUser,
  loadIntegration,
  ensureCapabilities,
  refreshCapabilities,
  type QboSettings,
} from '../_shared/quickbooks.ts';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = serviceClient();
  let user;
  try {
    user = await requireUser(req, supabase);
  } catch (e) {
    return json({ error: (e as Error).message }, 401);
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!profile || !['admin', 'owner', 'accountant'].includes(profile.role)) {
    return json({ error: 'Not allowed' }, 403);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const force = body?.force === true;

    const integration = await loadIntegration(supabase);
    const settings = (integration?.settings ?? {}) as QboSettings;
    if (!integration?.is_active || !settings.refresh_token) {
      return json({ connected: false, capabilities: null });
    }

    const capabilities = force
      ? await refreshCapabilities(supabase)
      : await ensureCapabilities(supabase, settings);

    const after = await loadIntegration(supabase);
    const s = (after?.settings ?? {}) as QboSettings;

    return json({
      connected: true,
      capabilities,
      checked_at: s.capabilities_checked_at ?? null,
      error: s.capabilities_error ?? null,
    });
  } catch (e) {
    const message = (e as Error).message;
    console.error('quickbooks-capabilities error', message);
    return json({ error: message }, 500);
  }
});
