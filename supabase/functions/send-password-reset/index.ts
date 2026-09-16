// Sends a branded password reset email via Resend. Public endpoint (verify_jwt = false).
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { emailServiceClient, loadEmailSettings, appUrl, sendDirect } from '../_shared/email.ts';
import { passwordResetEmail } from '../_shared/email-templates.ts';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

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
    const base = /^https?:\/\//.test(origin) ? origin.replace(/\/+$/, '') : appUrl(settings);

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
