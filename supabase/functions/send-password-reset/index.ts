// Sends a branded password reset email via Resend. Public endpoint (verify_jwt = false).
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { allowedOrigin } from '../_shared/ebay-oauth-origin.ts';
import { emailServiceClient, loadEmailSettings, appUrl, sendDirect } from '../_shared/email.ts';
import { passwordResetEmail } from '../_shared/email-templates.ts';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

// Per-address throttle: at most MAX_PER_HOUR reset emails per address per hour.
const MAX_PER_HOUR = 3;

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body?.email ?? '').trim().toLowerCase();
    const origin = typeof body?.origin === 'string' ? body.origin : '';

    if (!EMAIL_RE.test(email) || email.length > 320) {
      return json({ error: 'Enter a valid email address' }, 400);
    }

    const supabase = emailServiceClient();
    const settings = await loadEmailSettings(supabase);
    const fallbackBase = appUrl(settings).replace(/\/+$/, '');
    // Throttle silently (same reply) so callers can't spam or probe addresses.
    const emailHash = await sha256(email);
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from('password_reset_attempts')
      .select('id', { count: 'exact', head: true })
      .eq('email_hash', emailHash)
      .gte('created_at', since);
    if ((count ?? 0) >= MAX_PER_HOUR) {
      console.log('send-password-reset: throttled');
      return json({ ok: true });
    }
    await supabase.from('password_reset_attempts').insert({ email_hash: emailHash });
    // Housekeeping: drop entries older than a day.
    await supabase.from('password_reset_attempts').delete()
      .lt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    const base = origin ? allowedOrigin(origin, fallbackBase) : fallbackBase;

    const { data, error } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo: `${base}/reset-password` },
    });

    // Unknown addresses must not be revealed to the caller.
    if (error || !data?.properties?.action_link) {
      console.log('send-password-reset: no link generated', error?.message ?? 'no user');
      return json({ ok: true });
    }

    const { subject, html } = passwordResetEmail(data.properties.action_link);
    const result = await sendDirect(supabase, email, subject, html);
    if (!result.sent) console.error('send-password-reset: not sent —', result.reason);

    return json({ ok: true });
  } catch (e) {
    console.error('send-password-reset failed:', (e as Error).message);
    return json({ error: 'Could not send the reset email' }, 500);
  }
});
